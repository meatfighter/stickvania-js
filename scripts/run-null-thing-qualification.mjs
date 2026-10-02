/* global window, document */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "vite";
import { chromium, firefox } from "playwright";
const evidence = process.env.QUALIFICATION_EVIDENCE_DIR ?? join(tmpdir(), "stickvania-null-evidence");
mkdirSync(evidence, { recursive: true });
const baseline = process.env.STICKVANIA_NULL_BASELINE_DIR;
const plugins = baseline
    ? [
          {
              name: "exact-prior-playback-source",
              enforce: "pre",
              transform(source, id) {
                  for (const name of ["Main", "ThingStack", "WhiteSkeleton", "Dog", "RedSkeleton", "AxeKnight", "SmallHeart", "DropItem"])
                      if (existsSync(join(baseline, "baseline-stickvania-" + name + ".ts")) && id.replaceAll("\\", "/").endsWith("/stickvania/" + name + ".ts"))
                          return readFileSync(join(baseline, "baseline-stickvania-" + name + ".ts"), "utf8");
              }
          }
      ]
    : [];
const vite = await createServer({
    configFile: resolve("pwa/vite.config.ts"),
    plugins,
    server: { host: "127.0.0.1", port: 0, watch: null, hmr: false },
    logLevel: "warn"
});
await vite.listen();
try {
    for (const [name, type] of [
        ["chromium", chromium],
        ["firefox", firefox]
    ]) {
        const browser = await type.launch({
            headless: true,
            ...(name === "chromium" ? { args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] } : {})
        });
        try {
            const keeper = await browser.newPage();
            await keeper.goto("about:blank");
            for (const suite of baseline ? ["null-playback"] : ["null-boundary", "null-playback"]) {
                console.log(name + ": " + suite + (baseline ? " baseline" : " corrected"));
                const page = await browser.newPage();
                const errors = [];
                page.on("pageerror", (e) => errors.push(e.message));
                await page.goto("http://127.0.0.1:" + vite.httpServer.address().port + "/browser-verify.html?suite=" + suite);
                await page.waitForFunction(() => ["passed", "failed"].includes(document.querySelector("#result")?.dataset.status), null, { timeout: 180000 });
                assert.equal(await page.locator("#result").getAttribute("data-status"), "passed", await page.locator("#result").textContent());
                assert.deepEqual(errors, []);
                const data = await page.evaluate((suite) => Reflect.get(window, suite === "null-boundary" ? "nullThingEvidence" : "nullPlaybackTrace"), suite);
                writeFileSync(
                    join(evidence, `stickvania-${name}-${suite}-${baseline ? "baseline" : "corrected"}.json`),
                    JSON.stringify({ browser: browser.version(), suite, data })
                );
                await page.close();
            }
        } finally {
            await browser.close();
        }
    }
    const root = resolve(process.env.PWA_ROOT ?? "dist/pwa");
    const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
    for (const file of walk(root).filter((p) => /\.(js|html)$/.test(p))) {
        const source = readFileSync(file, "utf8");
        for (const marker of ["nullThingEvidence", "nullPlaybackTrace", "NullThingVerification"])
            assert.ok(!source.includes(marker), "Verification leak: " + file);
    }
} finally {
    await vite.close();
}
