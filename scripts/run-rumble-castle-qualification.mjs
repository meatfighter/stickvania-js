import { rumbleMutationPlugin } from "./rumble-mutation-plugin.mjs";
/* global window, document, localStorage */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "vite";
import { chromium, firefox } from "playwright";
const evidence = process.env.QUALIFICATION_EVIDENCE_DIR ?? join(tmpdir(), "stickvania-rumble-evidence");
mkdirSync(evidence, { recursive: true });
const vite = await createServer({
    configFile: resolve("pwa/vite.config.ts"),
    server: { host: "127.0.0.1", port: 0, watch: null, hmr: false },
    plugins: [rumbleMutationPlugin()],
    logLevel: "warn"
});
await vite.listen();
try {
    const origin = "http://127.0.0.1:" + vite.httpServer.address().port;
    for (const [name, type] of [
        ["chromium", chromium],
        ["firefox", firefox]
    ]) {
        const browser = await type.launch({
            headless: true,
            ...(name === "chromium" ? { args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] } : {})
        });
        try {
            const context = await browser.newContext(),
                page = await context.newPage(),
                errors = [];
            context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
            page.on("pageerror", (e) => errors.push(e.message));
            const run = async (p, suite) => {
                await p.goto(origin + "/browser-verify.html?suite=" + suite);
                await p.waitForFunction(() => ["passed", "failed"].includes(document.querySelector("#result")?.dataset.status), null, { timeout: 240000 });
                assert.equal(await p.locator("#result").getAttribute("data-status"), "passed", await p.locator("#result").textContent());
            };
            await run(page, "rumble-castle");
            const data = await page.evaluate(() => window.rumbleCastleEvidence);
            console.log(name + ": actual castle states, action cancellation, Main/store roundtrips passed");
            for (const checkpoint of data.checkpoints) {
                await page.evaluate((c) => {
                    localStorage.setItem("rumble-expected", c.expected);
                    const key = Object.keys(localStorage).find((k) => k.includes("game-state"));
                    if (!key) throw Error("Missing game-state slot");
                    localStorage.setItem(key, c.bytes);
                }, checkpoint);
                const fresh = await context.newPage();
                await run(fresh, "rumble-restore");
                await fresh.close();
            }
            assert.deepEqual(errors, []);
            writeFileSync(join(evidence, name + "-rumble-castle.json"), JSON.stringify({ browser: browser.version(), ...data }));
            console.log(name + ": " + data.checkpoints.length + " fresh-document castle phase roundtrips passed");
        } finally {
            await browser.close();
        }
    }
    const root = resolve(process.env.PWA_ROOT ?? "dist/pwa");
    const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
    for (const file of walk(root).filter((p) => /\.(js|html)$/.test(p))) {
        const s = readFileSync(file, "utf8");
        for (const marker of ["rumbleCastleEvidence", "RumbleCastleVerification", "rumble-expected"])
            assert(!s.includes(marker), "Release verification leak " + file);
    }
} finally {
    await vite.close();
}
