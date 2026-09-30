/* global document, window */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import { presentationMutationPlugin } from "./presentation-mutation-plugin.mjs";
const vite = await createServer({
    configFile: resolve("pwa/vite.config.ts"),
    server: { host: "127.0.0.1", port: 0, watch: null, hmr: false },
    plugins: [presentationMutationPlugin()],
    logLevel: "warn"
});
try {
    await vite.listen();
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/browser-verify.html?suite=presentation-state`);
        await page.waitForFunction(() => ["passed", "failed"].includes(document.querySelector("#result")?.dataset.status), null, { timeout: 240000 });
        assert.equal(await page.locator("#result").getAttribute("data-status"), "passed", await page.locator("#result").textContent());
        const result = await page.evaluate(() => window.presentationStateEvidence);
        console.log(JSON.stringify({ routes: result.routes, checkpoints: result.checkpoints.length, rejected: result.rejected.length }));
    } finally {
        await browser.close();
    }
} finally {
    await vite.close();
}
