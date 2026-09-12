/* global document, navigator, window, HTMLElement */
import assert from "node:assert/strict";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { chromium } from "playwright";

const root = resolve(process.env.PWA_ROOT ?? "dist/pwa");
assert(existsSync(resolve(root, "index.html")), `Missing production PWA: ${root}`);

const mime = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ogg": "audio/ogg",
    ".txt": "text/plain",
    ".xml": "application/xml"
};

const server = createServer((request, response) => {
    const requestUrl = new URL(request.url, "http://localhost");
    const file = resolve(root, "." + decodeURIComponent(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname));
    if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) {
        response.writeHead(404).end();
        return;
    }
    response.writeHead(200, { "Content-Type": mime[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    createReadStream(file).pipe(response);
});

await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
const url = `http://127.0.0.1:${server.address().port}/`;

let browser = null;
try {
    browser = await chromium.launch({ headless: false, args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });

    await qualifySupportedTouchFullscreenAndContinue(browser, url);
    await qualifyDelayedVoidFullscreen(browser, url);
    await qualifyDesktopFullscreenExit(browser, url);
    await qualifyPreferenceOffAndReset(browser, url);
    await qualifyRejectedFullscreen(browser, url);
    await qualifyExplicitUnavailableFullscreen(browser, url);
    await qualifyMissingFullscreenMethod(browser, url);
    await qualifyUnknownFullscreenCapability(browser, url);
    await qualifyPendingColdStartDeparture(browser, url);
    await qualifyPendingRetainedContinueDeparture(browser, url);
    await qualifyNeverSettlingRetainedRequest(browser, url);
    await qualifyHangingExitRequiresActualFullscreenExit(browser, url);

    console.log(
        "Stickvania fullscreen qualification passed: entry, Continue, desktop exit, persistence, rejection, unavailable/missing/unknown fallback, late/stuck request fencing, and actual-state exit barriers are correct."
    );
} finally {
    if (browser !== null) {
        await browser.close();
    }
    await new Promise((resolveClose) => server.close(resolveClose));
}

async function qualifySupportedTouchFullscreenAndContinue(browser, url) {
    const { context, errors, page } = await createHarnessPage(browser, url, "success", true);
    try {
        const fullscreenSwitch = await waitForMenu(page);
        assert.equal(await fullscreenSwitch.isEnabled(), true, "supported fullscreen switch is disabled");
        assert.equal(await fullscreenSwitch.getAttribute("aria-pressed"), "true", "fullscreen preference does not default on");
        await page.locator("#new-game-button").click();
        await waitForFullscreenRunning(page, true);
        const originalCanvas = await page.locator("canvas").elementHandle();
        assert.ok(originalCanvas, "missing initial game canvas");
        assert.equal(await page.evaluate(() => document.fullscreenElement?.id), "game-shell", "wrong fullscreen target");
        assert.equal(await page.locator("#game-shell .menu-screen").count(), 0, "PWA menu is inside the fullscreen shell");
        await page.locator("#hamburger-button").click();
        await waitForLiveMenu(page);
        assert.equal(await fullscreenSwitchState(page), "true", "menu exit changed fullscreen preference");
        await page.locator("#continue-button").click();
        await waitForFullscreenRunning(page, true);
        assert.equal(await originalCanvas.evaluate((canvas) => canvas.isConnected), true, "live Continue replaced the retained game canvas");
        assert.equal(await page.evaluate(() => globalThis.__fullscreenHarness.requestCount()), 2, "New Game + live Continue did not issue exactly two requests");
        assert.deepEqual(errors, [], "supported fullscreen qualification produced uncaught browser errors");
    } finally {
        await context.close();
    }
}

async function qualifyDelayedVoidFullscreen(browser, url) {
    const { context, errors, page } = await createHarnessPage(browser, url, "delayed-void", true);
    try {
        const fullscreenSwitch = await waitForMenu(page);
        assert.equal(await fullscreenSwitch.isEnabled(), true);
        await page.locator("#new-game-button").click();
        await waitForFullscreenRunning(page, true);
        assert.equal(await page.evaluate(() => globalThis.__fullscreenHarness.requestCount()), 1, "delayed void request was not invoked exactly once");
        assert.equal(await fullscreenSwitchStateFromStorage(page), null, "fullscreen state unexpectedly wrote the default preference");
        assert.deepEqual(errors, [], "delayed void fullscreen request produced uncaught browser errors");
    } finally {
        await context.close();
    }
}

async function qualifyDesktopFullscreenExit(browser, url) {
    const { context, errors, page } = await createHarnessPage(browser, url, "success", false);
    try {
        await waitForMenu(page);
        await page.locator("#new-game-button").click();
        await waitForFullscreenRunning(page, false);
        assert.equal(await page.locator("#hamburger-button").isHidden(), true, "desktop fullscreen should hide the hamburger");
        await page.evaluate(() => globalThis.__fullscreenHarness.forceExit());
        await page.locator("#continue-button").waitFor({ state: "visible" });
        await page.waitForFunction(() => document.fullscreenElement === null);
        assert.equal(await fullscreenSwitchState(page), "true", "browser fullscreen exit changed the preference");
        assert.equal(await page.locator("canvas").count(), 1, "browser fullscreen exit should retain the live game");
        assert.deepEqual(errors, [], "desktop fullscreen exit produced uncaught browser errors");
    } finally {
        await context.close();
    }
}

async function qualifyPreferenceOffAndReset(browser, url) {
    const { context, errors, page } = await createHarnessPage(browser, url, "success", false);
    try {
        let fullscreenSwitch = await waitForMenu(page);
        await fullscreenSwitch.click();
        assert.equal(await fullscreenSwitchState(page), "false");
        await page.reload();
        fullscreenSwitch = await waitForMenu(page);
        assert.equal(await fullscreenSwitchState(page), "false", "Fullscreen OFF did not persist across reload");
        await page.locator("#reset-button").click();
        fullscreenSwitch = await waitForMenu(page);
        assert.equal(await fullscreenSwitchState(page), "true", "Reset did not restore Fullscreen ON");
        await fullscreenSwitch.click();
        await page.locator("#new-game-button").click();
        await waitForWindowedRunning(page);
        assert.equal(await page.evaluate(() => globalThis.__fullscreenHarness.requestCount()), 0, "Fullscreen OFF still issued a request");
        await page.keyboard.press("Escape");
        await page.locator("#continue-button").waitFor({ state: "visible" });
        assert.equal(await fullscreenSwitchState(page), "false", "Esc changed the Fullscreen preference");
        assert.deepEqual(errors, [], "Fullscreen preference qualification produced uncaught browser errors");
    } finally {
        await context.close();
    }
}

async function qualifyRejectedFullscreen(browser, url) {
    const { context, errors, page } = await createHarnessPage(browser, url, "reject", false);
    try {
        const fullscreenSwitch = await waitForMenu(page);
        assert.equal(await fullscreenSwitch.isEnabled(), true, "rejecting fullscreen surface should still advertise capability");
        await page.locator("#new-game-button").click();
        await waitForWindowedRunning(page);
        assert.equal(await page.evaluate(() => globalThis.__fullscreenHarness.requestCount()), 1, "rejection case did not attempt fullscreen exactly once");
        await page.locator("#hamburger-button").click();
        await page.locator("#continue-button").waitFor({ state: "visible" });
        assert.equal(await fullscreenSwitchState(page), "true", "rejection changed fullscreen preference");
        assert.equal(await page.locator(".error-text:not([hidden])").count(), 0, "fullscreen rejection surfaced a user-facing error");
        assert.deepEqual(errors, [], "fullscreen rejection produced an uncaught browser error");
    } finally {
        await context.close();
    }
}

async function qualifyExplicitUnavailableFullscreen(browser, url) {
    const { context, errors, page } = await createHarnessPage(browser, url, "unavailable", false);
    try {
        const fullscreenSwitch = await waitForMenu(page);
        assert.equal(await fullscreenSwitch.isEnabled(), false, "explicitly unavailable fullscreen should disable the switch");
        assert.equal(await fullscreenSwitch.getAttribute("aria-pressed"), "false", "disabled switch should present OFF");
        assert.equal(await fullscreenSwitch.getAttribute("data-enabled"), "false", "disabled switch should render OFF");
        assert.equal(await fullscreenSwitchStateFromStorage(page), null, "unavailable presentation rewrote the stored default preference");
        await page.locator("#new-game-button").click();
        await waitForWindowedRunning(page);
        assert.equal(await page.evaluate(() => globalThis.__fullscreenHarness.requestCount()), 0, "explicitly unavailable browser made a fullscreen request");
        assert.deepEqual(errors, [], "explicit unavailable fallback produced uncaught browser errors");
    } finally {
        await context.close();
    }
}

async function qualifyMissingFullscreenMethod(browser, url) {
    const { context, errors, page } = await createHarnessPage(browser, url, "missing", false);
    try {
        const fullscreenSwitch = await waitForMenu(page);
        assert.equal(await fullscreenSwitch.isEnabled(), false, "missing fullscreen request method should disable the switch");
        assert.equal(await fullscreenSwitch.getAttribute("aria-pressed"), "false");
        assert.equal(await fullscreenSwitch.getAttribute("data-enabled"), "false");
        assert.equal(await fullscreenSwitchStateFromStorage(page), null, "missing-method fallback rewrote the stored default preference");
        await page.locator("#new-game-button").click();
        await waitForWindowedRunning(page);
        assert.equal(await page.evaluate(() => globalThis.__fullscreenHarness.requestCount()), 0, "missing request method should fall back without a native call");
        await page.locator("#hamburger-button").click();
        await page.locator("#continue-button").waitFor({ state: "visible" });
        assert.equal(await fullscreenSwitchState(page), "false", "missing-method control should remain presented OFF");
        assert.equal(await page.locator(".error-text:not([hidden])").count(), 0, "missing-method fallback showed a fullscreen error");
        assert.deepEqual(errors, [], "missing-method fallback produced uncaught browser errors");
    } finally {
        await context.close();
    }
}

async function qualifyUnknownFullscreenCapability(browser, url) {
    const { context, errors, page } = await createHarnessPage(browser, url, "unknown", false);
    try {
        const fullscreenSwitch = await waitForMenu(page);
        assert.equal(await fullscreenSwitch.isEnabled(), true, "unknown but callable fullscreen should remain enabled");
        assert.equal(await fullscreenSwitch.getAttribute("aria-pressed"), "true");
        await page.locator("#new-game-button").click();
        await waitForWindowedRunning(page);
        assert.equal(await page.evaluate(() => globalThis.__fullscreenHarness.requestCount()), 1, "unknown capability did not make one best-effort request");
        assert.equal(await fullscreenSwitchStateFromStorage(page), null, "unknown capability rewrote the default preference");
        assert.equal(await page.locator(".error-text:not([hidden])").count(), 0, "unknown capability fallback showed a fullscreen error");
        assert.deepEqual(errors, [], "unknown capability fallback produced uncaught browser errors");
    } finally {
        await context.close();
    }
}

async function qualifyPendingColdStartDeparture(browser, url) {
    const { context, errors, page } = await createHarnessPage(browser, url, "pending-blur", false);
    try {
        await waitForMenu(page);
        await page.locator("#new-game-button").click({ noWaitAfter: true });
        await page.waitForFunction(() => globalThis.__fullscreenHarness.requestCount() === 1);
        await page.locator("#new-game-button").waitFor({ state: "visible" });
        assert.equal(await page.locator("canvas").count(), 0, "pending cold-start departure retained gameplay");
        assert.notEqual(await page.locator("#app").evaluate((element) => element.style.visibility), "hidden");
        await page.evaluate(() => globalThis.__fullscreenHarness.resolvePending());
        await page.waitForFunction(() => document.fullscreenElement === null && document.querySelector("#app")?.style.visibility !== "hidden");
        await page.locator("#new-game-button").waitFor({ state: "visible" });
        assert.equal(await page.locator("canvas").count(), 0, "late retired request restarted gameplay");
        assert.deepEqual(errors, [], "pending cold-start departure produced uncaught browser errors");
    } finally {
        await context.close();
    }
}

async function qualifyPendingRetainedContinueDeparture(browser, url) {
    const { context, errors, page } = await createHarnessPage(browser, url, "success", true);
    try {
        await waitForMenu(page);
        await page.locator("#new-game-button").click();
        await waitForFullscreenRunning(page, true);
        const retainedCanvas = await page.locator("canvas").elementHandle();
        assert.ok(retainedCanvas);
        await page.locator("#hamburger-button").click();
        await waitForLiveMenu(page);
        await page.evaluate(() => globalThis.__fullscreenHarness.setMode("pending"));
        await page.locator("#continue-button").click({ noWaitAfter: true });
        await page.waitForFunction(() => globalThis.__fullscreenHarness.requestCount() === 2);
        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        await page.evaluate(() => globalThis.__fullscreenHarness.resolvePending());
        await page.locator("#continue-button").waitFor({ state: "visible" });
        await page.waitForFunction(() => document.fullscreenElement === null);
        assert.equal(await retainedCanvas.evaluate((canvas) => canvas.isConnected), true, "interrupted live Continue destroyed the retained canvas");
        assert.equal(await page.locator("canvas").count(), 1);
        assert.deepEqual(errors, [], "pending retained-Continue departure produced uncaught browser errors");
    } finally {
        await context.close();
    }
}

async function qualifyNeverSettlingRetainedRequest(browser, url) {
    const { context, errors, page } = await createHarnessPage(browser, url, "success", true);
    try {
        const fullscreenSwitch = await waitForMenu(page);
        await fullscreenSwitch.click();
        await fullscreenSwitch.click();
        await page.locator("#new-game-button").click();
        await waitForFullscreenRunning(page, true);
        const retainedCanvas = await page.locator("canvas").elementHandle();
        assert.ok(retainedCanvas);
        await page.locator("#hamburger-button").click();
        await waitForLiveMenu(page);
        await page.evaluate(() => globalThis.__fullscreenHarness.setMode("pending"));
        await page.locator("#continue-button").click({ noWaitAfter: true });
        await page.waitForFunction(() => globalThis.__fullscreenHarness.requestCount() === 2);
        await page.evaluate(() => window.dispatchEvent(new Event("blur")));
        await page.locator("#continue-button").waitFor({ state: "visible", timeout: 10_000 });
        await page.locator("#continue-button").click();
        await waitForWindowedRunning(page);
        assert.equal(await page.evaluate(() => globalThis.__fullscreenHarness.requestCount()), 2, "suppressed retained presentation made a third fullscreen request");
        await page.evaluate(() => globalThis.__fullscreenHarness.resolvePending());
        await page.waitForFunction(() => document.fullscreenElement === null);
        await waitForWindowedRunning(page);
        assert.equal(await page.locator("#continue-button").count(), 0, "late stale request returned the running game to MENU");
        assert.equal(await fullscreenSwitchStateFromStorage(page), "true", "late stale request mutated the stored preference");
        assert.deepEqual(errors, [], "never-settling retained request produced uncaught browser errors");
    } finally {
        await context.close();
    }
}

async function qualifyHangingExitRequiresActualFullscreenExit(browser, url) {
    const { context, errors, page } = await createHarnessPage(browser, url, "success", true);
    try {
        await waitForMenu(page);
        await page.locator("#new-game-button").click();
        await waitForFullscreenRunning(page, true);
        await page.evaluate(() => globalThis.__fullscreenHarness.setExitMode("pending"));
        await page.locator("#hamburger-button").click({ noWaitAfter: true });
        await page.waitForTimeout(150);
        assert.equal(await page.evaluate(() => document.fullscreenElement?.id), "game-shell", "synthetic hanging exit unexpectedly left fullscreen");
        assert.equal(await page.locator("#continue-button").count(), 0, "PWA menu became visible before actual fullscreen exit");
        await page.evaluate(() => globalThis.__fullscreenHarness.forceExit());
        await waitForLiveMenu(page);
        assert.deepEqual(errors, [], "hanging exit qualification produced uncaught browser errors");
    } finally {
        await context.close();
    }
}

async function createHarnessPage(browser, url, mode, touch) {
    const context = await browser.newContext();
    context.setDefaultTimeout(60_000);
    await installFullscreenHarness(context, mode, touch);
    const errors = [];
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url);
    return { context, errors, page };
}

async function waitForMenu(page) {
    const fullscreenSwitch = page.locator("#fullscreen-switch-button").first();
    await fullscreenSwitch.waitFor({ state: "visible" });
    await page.locator("#new-game-button").waitFor({ state: "visible" });
    return fullscreenSwitch;
}

async function waitForLiveMenu(page) {
    await page.locator("#continue-button").waitFor({ state: "visible" });
    await page.waitForFunction(() => document.fullscreenElement === null);
    assert.equal(await page.locator("canvas").count(), 1, "live menu did not retain exactly one canvas");
}

async function waitForFullscreenRunning(page, expectHamburger) {
    await page.locator("canvas").waitFor({ state: "visible" });
    await page.waitForFunction(() => document.fullscreenElement?.id === "game-shell");
    if (expectHamburger) {
        await page.locator("#hamburger-button:not([hidden])").waitFor({ state: "visible" });
    } else {
        await page.waitForFunction(() => document.querySelector("#hamburger-button")?.hidden === true);
    }
}

async function waitForWindowedRunning(page) {
    await page.locator("canvas").waitFor({ state: "visible" });
    await page.locator("#hamburger-button:not([hidden])").waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => document.fullscreenElement), null);
}

async function fullscreenSwitchState(page) {
    return page.locator("#fullscreen-switch-button").first().getAttribute("aria-pressed");
}

async function fullscreenSwitchStateFromStorage(page) {
    return page.evaluate(() => {
        const entry = Object.entries(localStorage).find(([key]) => key.includes("fullscreen"));
        return entry?.[1] ?? null;
    });
}

async function installFullscreenHarness(context, initialMode, touch) {
    await context.addInitScript(
        ({ initialMode, touch }) => {
            let mode = initialMode;
            let exitMode = "success";
            let fullscreenElement = null;
            const setSyntheticFullscreenElement = (element) => {
                fullscreenElement = element;
            };
            let requestCount = 0;
            let pendingResolve = null;

            Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: touch ? 1 : 0 });
            Object.defineProperty(document, "fullscreenEnabled", {
                configurable: true,
                get: () => (mode === "unknown" || mode === "missing" ? undefined : mode !== "unavailable")
            });
            Object.defineProperty(document, "webkitFullscreenEnabled", {
                configurable: true,
                get: () => (mode === "unknown" || mode === "missing" ? undefined : mode !== "unavailable")
            });
            Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreenElement });
            Object.defineProperty(document, "exitFullscreen", {
                configurable: true,
                value: () => {
                    if (exitMode === "pending") {
                        return new Promise(() => undefined);
                    }
                    if (fullscreenElement !== null) {
                        fullscreenElement = null;
                        document.dispatchEvent(new Event("fullscreenchange"));
                    }
                    return Promise.resolve();
                }
            });
            Object.defineProperty(HTMLElement.prototype, "webkitRequestFullscreen", { configurable: true, value: undefined });
            Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
                configurable: true,
                value: function () {
                    requestCount++;
                    if (mode === "reject" || mode === "unknown") {
                        return Promise.reject(new DOMException("Synthetic fullscreen denial", "NotAllowedError"));
                    }
                    if (mode === "pending" || mode === "pending-blur") {
                        if (mode === "pending-blur") {
                            window.dispatchEvent(new Event("blur"));
                        }
                        return new Promise((resolve) => {
                            pendingResolve = () => {
                                setSyntheticFullscreenElement(this);
                                document.dispatchEvent(new Event("fullscreenchange"));
                                resolve();
                                pendingResolve = null;
                            };
                        });
                    }
                    if (mode === "delayed-void") {
                        window.setTimeout(() => {
                            setSyntheticFullscreenElement(this);
                            document.dispatchEvent(new Event("fullscreenchange"));
                        }, 25);
                        return undefined;
                    }
                    setSyntheticFullscreenElement(this);
                    document.dispatchEvent(new Event("fullscreenchange"));
                    return Promise.resolve();
                }
            });
            if (initialMode === "missing") {
                Object.defineProperty(HTMLElement.prototype, "requestFullscreen", { configurable: true, value: undefined });
            }
            Object.defineProperty(globalThis, "__fullscreenHarness", {
                configurable: true,
                value: {
                    requestCount: () => requestCount,
                    resolvePending: () => pendingResolve?.(),
                    setMode: (nextMode) => {
                        mode = nextMode;
                    },
                    setExitMode: (nextMode) => {
                        exitMode = nextMode;
                    },
                    forceExit: () => {
                        if (fullscreenElement !== null) {
                            fullscreenElement = null;
                            document.dispatchEvent(new Event("fullscreenchange"));
                        }
                    }
                }
            });
        },
        { initialMode, touch }
    );
}
