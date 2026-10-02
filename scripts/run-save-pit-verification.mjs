import { qualifyPackagedPresentation } from "./qualify-presentation-packaged.mjs";
/* global document, window, localStorage */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "vite";
import { chromium, firefox } from "playwright";
const server = await createServer({
    configFile: resolve("pwa/vite.config.ts"),
    server: { host: "127.0.0.1", port: 0, watch: null, hmr: false },
    logLevel: "warn"
});
try {
    await server.listen();
    for (const [name, type] of [
        ["chromium", chromium],
        ["firefox", firefox]
    ]) {
        const browser = await type.launch({ headless: true });
        try {
            const page = await browser.newPage();
            page.on("console", (msg) => {
                if (msg.type() === "error" || msg.type() === "warning") console.log(msg.text());
            });
            await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/browser-verify.html?suite=save-pit`);
            await page.waitForFunction(() => ["passed", "failed"].includes(document.querySelector("#result")?.dataset.status), null, { timeout: 240000 });
            if ((await page.locator("#result").getAttribute("data-status")) !== "passed")
                console.log(
                    await page.evaluate(() =>
                        Object.keys(localStorage)
                            .filter((k) => k.endsWith(":debug-invalid-save"))
                            .map((k) => JSON.parse(localStorage.getItem(k)))
                            .map((r) => ({ stage: r.failedStage, summary: r.summary }))
                    )
                );
            assert.equal(await page.locator("#result").getAttribute("data-status"), "passed", await page.locator("#result").textContent());
            const records = await page.evaluate(() => window.savePitEvidence);
            const packagedLabels = [
                "intro-consumed-zero-inner-ticks",
                "pending-replacement-old-paused",
                "pending-replacement-watch-expired",
                "WhiteSkeleton-pit-history-2199",
                "pit-knight-dead-owner-reflected-lock",
                "stage-three-real-floor-constructor",
                "stage-three-floor-terminal-fade",
                "door-1-1-1-0-entry",
                "door-1-2-1-0-phase-3",
                "door-5-1-1-0-entry",
                "door-5-1-1-0-complete",
                "dracula-death-cue",
                "dracula-visible-orb",
                "dracula-orb-pending-ending",
                "dracula-castle"
            ];
            const packaged = process.argv.includes("--source-only") ? [] : await qualifyPackagedPresentation(browser, records, packagedLabels);
            if (process.env.QUALIFICATION_EVIDENCE_DIR) {
                mkdirSync(process.env.QUALIFICATION_EVIDENCE_DIR, { recursive: true });
                writeFileSync(
                    resolve(process.env.QUALIFICATION_EVIDENCE_DIR, `${name}-save-pit-witnesses.json`),
                    JSON.stringify({ records, packaged, diagnosticTiming: await page.evaluate(() => window.savePitDiagnosticTiming) }, null, 2)
                );
            }
            console.log(JSON.stringify({ browser: name, version: browser.version(), sourceCheckpoints: records.length, packaged }));
        } finally {
            await browser.close();
        }
    }
} finally {
    await server.close();
}
