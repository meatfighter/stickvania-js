/* global document, navigator, window, HTMLElement, EventTarget */
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
    const context = await browser.newContext();
    context.setDefaultTimeout(60_000);
    await installFullscreenAndWakeLockHarness(context);

    const errors = [];
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url);

    const fullscreenSwitch = page.locator("#fullscreen-switch-button").first();
    await fullscreenSwitch.waitFor({ state: "visible" });
    assert.equal(await fullscreenSwitch.isEnabled(), true, "Fullscreen should be available in the settings qualifier");
    assert.equal(await fullscreenSwitch.getAttribute("aria-pressed"), "true", "Fullscreen should default ON");

    await selectMenuOption(page, "#display-mode-button", '[data-display-mode="dark"]');
    await selectMenuOption(page, "#scaling-button", '[data-scaling-mode="pixel-perfect"]');
    await assertMenuPreferences(page, "Dark", "dark", "Pixel Perfect", "pixel-perfect");
    await assertWakeAccounting(page, 0, "initial menu");

    await page.locator("#new-game-button").click();
    await waitForFullscreenRunning(page);
    const retainedCanvas = await page.locator("canvas").elementHandle();
    assert.ok(retainedCanvas, "missing retained canvas after New Game");
    await assertWakeAccounting(page, 1, "New Game fullscreen");

    await page.locator("#hamburger-button").click();
    await waitForLiveMenu(page);
    await assertMenuPreferences(page, "Dark", "dark", "Pixel Perfect", "pixel-perfect");
    await assertWakeAccounting(page, 0, "first live menu");

    await selectMenuOption(page, "#display-mode-button", '[data-display-mode="sepia"]');
    await selectMenuOption(page, "#scaling-button", '[data-scaling-mode="smooth"]');
    await assertMenuPreferences(page, "Sepia", "sepia", "Smooth", "smooth");

    await page.locator("#continue-button").click();
    await waitForFullscreenRunning(page);
    assert.equal(await retainedCanvas.evaluate((canvas) => canvas.isConnected), true, "retained Continue replaced the canvas after settings changes");
    await assertWakeAccounting(page, 1, "retained Continue fullscreen");

    await page.locator("#hamburger-button").click();
    await waitForLiveMenu(page);
    await assertMenuPreferences(page, "Sepia", "sepia", "Smooth", "smooth");
    await assertWakeAccounting(page, 0, "second live menu");

    assert.equal(
        await page.evaluate(() => globalThis.__stickvaniaSettingsHarness.requestCount()),
        2,
        "New Game + retained Continue should make two fullscreen requests"
    );
    assert.deepEqual(errors, [], "Stickvania fullscreen settings qualification produced uncaught browser errors");
    console.log(
        "Stickvania fullscreen settings qualification passed: Theme, Scaling, retained canvas, and wake-lock accounting survive fullscreen MENU/Continue cycles."
    );
    await context.close();
} finally {
    if (browser !== null) {
        await browser.close();
    }
    await new Promise((resolveClose) => server.close(resolveClose));
}

async function selectMenuOption(page, buttonSelector, optionSelector) {
    await page.locator(buttonSelector).click();
    const option = page.locator(optionSelector).first();
    await option.waitFor({ state: "visible" });
    await option.click();
}

async function assertMenuPreferences(page, themeLabel, themeValue, scalingLabel, scalingValue) {
    assert.equal(await page.locator("#display-mode-button .theme-picker-label").textContent(), themeLabel, `Theme label should remain ${themeLabel}`);
    assert.equal(await page.locator(`[data-display-mode="${themeValue}"]`).getAttribute("aria-selected"), "true", `Theme ${themeValue} should remain selected`);
    assert.equal(await page.locator("#scaling-button .scaling-picker-label").textContent(), scalingLabel, `Scaling label should remain ${scalingLabel}`);
    assert.equal(
        await page.locator(`[data-scaling-mode="${scalingValue}"]`).getAttribute("aria-selected"),
        "true",
        `Scaling ${scalingValue} should remain selected`
    );
    assert.equal(await storedPreference(page, "display-mode"), themeValue, `Stored Theme should remain ${themeValue}`);
    assert.equal(await storedPreference(page, "scaling"), scalingValue, `Stored Scaling should remain ${scalingValue}`);
}

async function storedPreference(page, keyFragment) {
    return page.evaluate((fragment) => Object.entries(localStorage).find(([key]) => key.includes(fragment))?.[1] ?? null, keyFragment);
}

async function waitForFullscreenRunning(page) {
    await page.locator("canvas").waitFor({ state: "visible" });
    await page.waitForFunction(() => document.fullscreenElement?.id === "game-shell");
    await page.locator("#hamburger-button:not([hidden])").waitFor({ state: "visible" });
}

async function waitForLiveMenu(page) {
    await page.locator("#continue-button").waitFor({ state: "visible" });
    await page.waitForFunction(() => document.fullscreenElement === null);
    assert.equal(await page.locator("canvas").count(), 1, "live menu should retain exactly one canvas");
}

async function assertWakeAccounting(page, expectedLive, label) {
    await page.waitForFunction(
        (expected) => globalThis.__stickvaniaSettingsHarness?.wakeStats().live === expected,
        expectedLive,
        { timeout: 5_000 }
    );
    const stats = await page.evaluate(() => globalThis.__stickvaniaSettingsHarness.wakeStats());
    assert.equal(stats.live, expectedLive, `${label}: unexpected live wake-lock count`);
    assert.equal(stats.acquired - stats.released, stats.live, `${label}: wake-lock acquisitions/releases are not balanced`);
    assert.ok(stats.released <= stats.acquired, `${label}: wake-lock release count exceeded acquisitions`);
}

async function installFullscreenAndWakeLockHarness(context) {
    await context.addInitScript(() => {
        let fullscreenElement = null;
        let fullscreenRequests = 0;
        let wakeAcquired = 0;
        let wakeReleased = 0;
        const wakeLive = new Set();

        class SyntheticWakeLockSentinel extends EventTarget {
            released = false;

            async release() {
                if (this.released) {
                    return;
                }
                this.released = true;
                if (wakeLive.delete(this)) {
                    wakeReleased++;
                }
                this.dispatchEvent(new Event("release"));
            }
        }

        Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: 1 });
        Object.defineProperty(navigator, "wakeLock", {
            configurable: true,
            value: {
                request: async (type) => {
                    if (type !== "screen") {
                        throw new TypeError(`Unexpected wake-lock type: ${String(type)}`);
                    }
                    const sentinel = new SyntheticWakeLockSentinel();
                    wakeAcquired++;
                    wakeLive.add(sentinel);
                    return sentinel;
                }
            }
        });
        Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
        Object.defineProperty(document, "webkitFullscreenEnabled", { configurable: true, value: true });
        Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreenElement });
        Object.defineProperty(document, "exitFullscreen", {
            configurable: true,
            value: async () => {
                if (fullscreenElement !== null) {
                    fullscreenElement = null;
                    document.dispatchEvent(new Event("fullscreenchange"));
                }
            }
        });
        Object.defineProperty(HTMLElement.prototype, "webkitRequestFullscreen", { configurable: true, value: undefined });
        Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
            configurable: true,
            value: function () {
                fullscreenRequests++;
                fullscreenElement = this;
                document.dispatchEvent(new Event("fullscreenchange"));
                return Promise.resolve();
            }
        });
        Object.defineProperty(globalThis, "__stickvaniaSettingsHarness", {
            configurable: true,
            value: {
                requestCount: () => fullscreenRequests,
                wakeStats: () => ({ acquired: wakeAcquired, released: wakeReleased, live: wakeLive.size })
            }
        });
    });
}
