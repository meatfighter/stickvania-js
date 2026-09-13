import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { cleanupBrowser, findBrowser, launchBrowser, stopChild, waitForExpression, waitForHttpServer } from "./browser-test-utils.mjs";
import { rootDir } from "./build-utils.mjs";

const port = 5198;
const browserVerificationUrl = `http://127.0.0.1:${port}/browser-verify.html`;
const appUrl = `http://127.0.0.1:${port}/`;
const viteBin = resolve(rootDir, "node_modules", "vite", "bin", "vite.js");
const stylesSource = readFileSync(resolve(rootDir, "pwa", "src", "styles.css"), "utf8");
verifyGameplayViewportCssContract(stylesSource);
const server = spawn(process.execPath, [viteBin, "--config", "pwa/vite.config.ts", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: rootDir,
    stdio: ["ignore", "pipe", "pipe"]
});
let browser = null;
try {
    await waitForHttpServer(server, browserVerificationUrl);
    browser = await launchBrowser(browserVerificationUrl, rootDir, "stickvania-browser-");
    const output = await waitForExpression(
        browser.page,
        '(() => { const element = document.querySelector("#result"); if (element?.dataset.status === "failed") throw new Error(element.textContent || "Browser verification failed."); return element?.dataset.status === "passed" ? element.textContent : false; })()'
    );
    console.log(output);
    await verifySessionOwnership(appUrl, "Stickvania");
} finally {
    await cleanupBrowser(browser);
    await stopChild(server);
}

async function verifySessionOwnership(url, gameName) {
    const executablePath = await findBrowser();
    const ownershipBrowser = await chromium.launch({
        executablePath,
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu-sandbox"]
    });

    try {
        const context = await ownershipBrowser.newContext({ viewport: { width: 800, height: 600 } });
        const first = await context.newPage();
        await first.goto(url, { waitUntil: "domcontentloaded" });

        const scalingLabel = first.locator(".setting-scaling-row > span").first();
        const primaryButton = first.locator(".start-button:not(:disabled)").first();
        await scalingLabel.waitFor({ state: "visible", timeout: 30_000 });
        await primaryButton.waitFor({ state: "visible", timeout: 30_000 });
        await verifyMenuLayout(first);

        const messageReference = await readComputedStyles(scalingLabel, ["fontFamily", "fontSize", "fontWeight", "color"]);
        const buttonReference = await readComputedStyles(primaryButton, [
            "backgroundColor",
            "color",
            "fontFamily",
            "fontSize",
            "fontWeight",
            "borderRadius",
            "minHeight",
            "minWidth",
            "paddingTop",
            "paddingRight",
            "paddingBottom",
            "paddingLeft"
        ]);

        const second = await context.newPage();
        await second.setViewportSize({ width: 360, height: 640 });
        await second.goto(url, { waitUntil: "domcontentloaded" });

        const ownershipMessage = second.locator(".session-ownership-message");
        const continueButton = second.getByRole("button", { name: "Continue Here" });
        await ownershipMessage.waitFor({ state: "visible", timeout: 30_000 });
        await continueButton.waitFor({ state: "visible", timeout: 30_000 });

        assert.equal(await ownershipMessage.textContent(), "Your game is open in another tab.");
        assert.equal(await continueButton.getAttribute("class"), "start-button");
        assert.deepEqual(await readComputedStyles(ownershipMessage, ["fontFamily", "fontSize", "fontWeight", "color"]), messageReference);
        assert.deepEqual(
            await readComputedStyles(continueButton, [
                "backgroundColor",
                "color",
                "fontFamily",
                "fontSize",
                "fontWeight",
                "borderRadius",
                "minHeight",
                "minWidth",
                "paddingTop",
                "paddingRight",
                "paddingBottom",
                "paddingLeft"
            ]),
            buttonReference
        );

        const wrapping = await ownershipMessage.evaluate((element) => {
            element.textContent = "The other tab has not released your game. Close it, then try again.";
            const style = globalThis.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return {
                clientWidth: element.clientWidth,
                display: style.display,
                documentClientWidth: globalThis.document.documentElement.clientWidth,
                documentScrollWidth: globalThis.document.documentElement.scrollWidth,
                height: rect.height,
                innerWidth: globalThis.innerWidth,
                left: rect.left,
                lineHeight: Number.parseFloat(style.lineHeight),
                right: rect.right,
                scrollWidth: element.scrollWidth,
                whiteSpace: style.whiteSpace
            };
        });

        assert.equal(wrapping.innerWidth, 360);
        assert.equal(wrapping.display, "block");
        assert.equal(wrapping.whiteSpace, "normal");
        assert.ok(wrapping.left >= -0.5, `Ownership message extends past the left viewport edge: ${wrapping.left}`);
        assert.ok(wrapping.right <= wrapping.innerWidth + 0.5, `Ownership message extends past the right viewport edge: ${wrapping.right}`);
        assert.ok(wrapping.scrollWidth <= wrapping.clientWidth + 1, "Ownership message has horizontal overflow.");
        assert.ok(wrapping.documentScrollWidth <= wrapping.documentClientWidth + 1, "Ownership screen causes horizontal page overflow.");
        assert.ok(
            Number.isFinite(wrapping.lineHeight) && wrapping.height > wrapping.lineHeight * 1.5,
            "Long ownership messages should wrap to multiple lines."
        );

        await continueButton.click();
        await first.waitForFunction(() => globalThis.document.querySelector(".session-ownership-message")?.textContent === "Your game moved to another tab.");

        const movedMessage = first.locator(".session-ownership-message");
        assert.deepEqual(await readComputedStyles(movedMessage, ["fontFamily", "fontSize", "fontWeight", "color"]), messageReference);
        assert.equal(await movedMessage.evaluate((element) => globalThis.getComputedStyle(element).display), "block");

        await second.locator(".setting-scaling-row > span").first().waitFor({ state: "visible", timeout: 30_000 });
        await verifyGameplayViewportContainment(second);
        console.log(`${gameName} multi-tab ownership verification passed.`);
    } finally {
        await ownershipBrowser.close();
    }
}

async function verifyMenuLayout(page) {
    const themeRow = page.locator(".setting-theme-row");
    const rumbleRow = page.locator(".settings-row .setting-switch-row").first();
    const themePicker = page.locator("#display-mode-picker");
    await themeRow.waitFor({ state: "visible", timeout: 30_000 });
    await rumbleRow.waitFor({ state: "visible", timeout: 30_000 });
    await themePicker.waitFor({ state: "visible", timeout: 30_000 });

    const wide = await readMenuSettingGeometry(themeRow, rumbleRow, themePicker);
    const wideThemeCenter = wide.theme.y + wide.theme.height / 2;
    const wideRumbleCenter = wide.rumble.y + wide.rumble.height / 2;
    assert.ok(Math.abs(wideThemeCenter - wideRumbleCenter) <= 1, "Theme and Rumble should share a row when the menu is wide enough.");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(50);
    const narrow = await readMenuSettingGeometry(themeRow, rumbleRow, themePicker);
    assert.ok(narrow.rumble.y >= narrow.theme.y + narrow.theme.height + 1, "Theme and Rumble should wrap onto separate rows at iPhone portrait width.");
    assert.ok(Math.abs(narrow.picker.width - wide.picker.width) <= 1, "The Theme picker must not be compressed when the settings row wraps.");

    const viewport = await page.evaluate(() => {
        const picker = globalThis.document.querySelector("#display-mode-picker");
        const pickerRect = picker?.getBoundingClientRect();
        return {
            clientWidth: globalThis.document.documentElement.clientWidth,
            scrollWidth: globalThis.document.documentElement.scrollWidth,
            pickerLeft: pickerRect?.left ?? Number.NEGATIVE_INFINITY,
            pickerRight: pickerRect?.right ?? Number.POSITIVE_INFINITY
        };
    });
    assert.ok(viewport.pickerLeft >= -0.5, `Theme picker extends past the left viewport edge: ${viewport.pickerLeft}`);
    assert.ok(viewport.pickerRight <= viewport.clientWidth + 0.5, `Theme picker extends past the right viewport edge: ${viewport.pickerRight}`);
    assert.ok(viewport.scrollWidth <= viewport.clientWidth + 1, "Stickvania menu causes horizontal overflow at iPhone portrait width.");

    await page.setViewportSize({ width: 800, height: 600 });
    console.log("Stickvania responsive settings layout verification passed.");
}

async function verifyGameplayViewportContainment(page) {
    await disableFullscreenIfAvailable(page);
    await page.locator("#new-game-button").click();
    const shell = page.locator(".game-shell");
    const canvas = page.locator(".game-host canvas");
    await shell.waitFor({ state: "visible", timeout: 120_000 });
    await canvas.waitFor({ state: "visible", timeout: 120_000 });
    await page.locator("#hamburger-button").waitFor({ state: "visible", timeout: 120_000 });

    const viewportSequence = [
        { width: 375, height: 667, label: "iPhone 8 portrait" },
        { width: 667, height: 375, label: "iPhone 8 landscape" },
        { width: 667, height: 320, label: "iPhone 8 landscape with browser chrome" },
        { width: 667, height: 375, label: "restored iPhone 8 landscape" },
        { width: 375, height: 667, label: "restored iPhone 8 portrait" }
    ];

    for (const viewport of viewportSequence) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.waitForFunction(
            ({ width, height }) => {
                const shellElement = globalThis.document.querySelector(".game-shell");
                const canvasElement = globalThis.document.querySelector(".game-host canvas");
                if (!(shellElement instanceof globalThis.HTMLElement) || !(canvasElement instanceof globalThis.HTMLCanvasElement)) {
                    return false;
                }
                const shellRect = shellElement.getBoundingClientRect();
                const canvasRect = canvasElement.getBoundingClientRect();
                const tolerance = 1;
                const expectedAspectRatio = 512 / 416;
                const canvasAspectRatio = canvasRect.width / canvasRect.height;
                return (
                    Math.abs(shellRect.left) <= tolerance &&
                    Math.abs(shellRect.top) <= tolerance &&
                    Math.abs(shellRect.right - width) <= tolerance &&
                    Math.abs(shellRect.bottom - height) <= tolerance &&
                    canvasRect.left >= shellRect.left - tolerance &&
                    canvasRect.top >= shellRect.top - tolerance &&
                    canvasRect.right <= shellRect.right + tolerance &&
                    canvasRect.bottom <= shellRect.bottom + tolerance &&
                    Math.abs(canvasAspectRatio - expectedAspectRatio) <= 0.01
                );
            },
            { width: viewport.width, height: viewport.height },
            { timeout: 30_000 }
        );

        const geometry = await page.evaluate(() => {
            const shellElement = globalThis.document.querySelector(".game-shell");
            const canvasElement = globalThis.document.querySelector(".game-host canvas");
            if (!(shellElement instanceof globalThis.HTMLElement) || !(canvasElement instanceof globalThis.HTMLCanvasElement)) {
                throw new Error("Stickvania gameplay shell or canvas is missing.");
            }
            const shellRect = shellElement.getBoundingClientRect();
            const canvasRect = canvasElement.getBoundingClientRect();
            return {
                innerWidth: globalThis.innerWidth,
                innerHeight: globalThis.innerHeight,
                clientWidth: globalThis.document.documentElement.clientWidth,
                clientHeight: globalThis.document.documentElement.clientHeight,
                scrollWidth: globalThis.document.documentElement.scrollWidth,
                scrollHeight: globalThis.document.documentElement.scrollHeight,
                shell: { left: shellRect.left, top: shellRect.top, right: shellRect.right, bottom: shellRect.bottom },
                canvas: {
                    left: canvasRect.left,
                    top: canvasRect.top,
                    right: canvasRect.right,
                    bottom: canvasRect.bottom,
                    width: canvasRect.width,
                    height: canvasRect.height
                }
            };
        });

        assert.equal(geometry.innerWidth, viewport.width, `${viewport.label}: unexpected browser width.`);
        assert.equal(geometry.innerHeight, viewport.height, `${viewport.label}: unexpected browser height.`);
        assert.ok(Math.abs(geometry.shell.left) <= 1 && Math.abs(geometry.shell.top) <= 1, `${viewport.label}: game shell is offset from the viewport origin.`);
        assert.ok(
            Math.abs(geometry.shell.right - viewport.width) <= 1 && Math.abs(geometry.shell.bottom - viewport.height) <= 1,
            `${viewport.label}: game shell does not fill the current viewport.`
        );
        assert.ok(
            geometry.canvas.left >= geometry.shell.left - 1 && geometry.canvas.top >= geometry.shell.top - 1,
            `${viewport.label}: canvas starts outside the game shell.`
        );
        assert.ok(
            geometry.canvas.right <= geometry.shell.right + 1 && geometry.canvas.bottom <= geometry.shell.bottom + 1,
            `${viewport.label}: canvas extends outside the game shell.`
        );
        assert.ok(
            Math.abs(geometry.canvas.width / geometry.canvas.height - 512 / 416) <= 0.01,
            `${viewport.label}: Stickvania's 512x416 presentation ratio changed.`
        );
        assert.ok(geometry.scrollWidth <= geometry.clientWidth + 1, `${viewport.label}: gameplay causes horizontal page overflow.`);
        assert.ok(geometry.scrollHeight <= geometry.clientHeight + 1, `${viewport.label}: gameplay causes vertical page overflow.`);
    }

    console.log("Stickvania mobile gameplay viewport containment verification passed.");
}

async function disableFullscreenIfAvailable(page) {
    const fullscreenSwitch = page.locator("#fullscreen-switch-button").first();
    await fullscreenSwitch.waitFor({ state: "visible", timeout: 30_000 });
    if ((await fullscreenSwitch.isEnabled()) && (await fullscreenSwitch.getAttribute("aria-pressed")) === "true") {
        await fullscreenSwitch.click();
        assert.equal(await fullscreenSwitch.getAttribute("aria-pressed"), "false");
    }
}

function verifyGameplayViewportCssContract(source) {
    const shellRule = source.match(/\.game-shell,\s*\.game-shell:fullscreen,?\s*\.game-shell:-webkit-full-screen\s*\{([^}]*)\}/s)?.[1] ?? "";
    assert.notEqual(shellRule, "", "Stickvania gameplay shell CSS rule is missing.");
    assert.match(shellRule, /position:\s*fixed;/);
    assert.match(shellRule, /inset:\s*0;/);

    const canvasRule = source.match(/\.game-host canvas\s*\{([^}]*)\}/s)?.[1] ?? "";
    assert.notEqual(canvasRule, "", "Stickvania gameplay canvas CSS rule is missing.");
    assert.match(canvasRule, /max-width:\s*100%;/);
    assert.match(canvasRule, /max-height:\s*100%;/);
    assert.doesNotMatch(canvasRule, /max-(?:width|height):\s*100v[wh]/, "Gameplay canvas limits must be relative to the corrected host rectangle.");
}

async function readMenuSettingGeometry(themeRow, rumbleRow, themePicker) {
    const theme = await themeRow.boundingBox();
    const rumble = await rumbleRow.boundingBox();
    const picker = await themePicker.boundingBox();
    assert.ok(theme !== null, "Theme row must have layout geometry.");
    assert.ok(rumble !== null, "Rumble row must have layout geometry.");
    assert.ok(picker !== null, "Theme picker must have layout geometry.");
    return { theme, rumble, picker };
}

async function readComputedStyles(locator, properties) {
    return locator.evaluate((element, names) => {
        const style = globalThis.getComputedStyle(element);
        return Object.fromEntries(names.map((name) => [name, style[name]]));
    }, properties);
}
