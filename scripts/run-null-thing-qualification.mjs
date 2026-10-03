/* global window, document */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "vite";
import { chromium, firefox } from "playwright";
const evidence = process.env.QUALIFICATION_EVIDENCE_DIR ?? join(tmpdir(), "stickvania-null-evidence");
mkdirSync(evidence, { recursive: true });
const baseline = process.env.STICKVANIA_NULL_BASELINE_DIR;
const baselineCommit = "45566f2511f74d9e47fe3278286347bf4b8b9ac6";
const fingerprint = createHash("sha256")
    .update(readFileSync("pwa/src/NullThingVerification.ts"))
    .update(readFileSync(import.meta.filename))
    .update(readFileSync("package-lock.json"))
    .digest("hex");
const cache = join(tmpdir(), "stickvania-edge-baseline-" + fingerprint);
if (!baseline) {
    mkdirSync(cache, { recursive: true });
    if (!existsSync(join(cache, "complete"))) {
        for (const name of ["Main", "Raven", "BridgeBat", "GrimReaper"])
            writeFileSync(
                join(cache, "baseline-stickvania-" + name + ".ts"),
                execFileSync("git", ["show", baselineCommit + ":pwa/src/stickvania/" + name + ".ts"])
            );
        const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
            stdio: "inherit",
            windowsHide: true,
            env: { ...process.env, STICKVANIA_NULL_BASELINE_DIR: cache, QUALIFICATION_EVIDENCE_DIR: cache }
        });
        assert.equal(result.status, 0, "immutable baseline playback");
        writeFileSync(join(cache, "complete"), baselineCommit);
    }
}
function difference(a, b, path = "") {
    if (Object.is(a, b)) return "";
    if (a && b && typeof a === "object" && typeof b === "object") {
        for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
            const found = difference(a[key], b[key], path + "." + key);
            if (found) return found;
        }
        return "";
    }
    return path + ": " + JSON.stringify(a) + " != " + JSON.stringify(b);
}
const plugins = baseline
    ? [
          {
              name: "exact-prior-playback-source",
              enforce: "pre",
              transform(source, id) {
                  for (const name of [
                      "Main",
                      "Raven",
                      "BridgeBat",
                      "GrimReaper",
                      "ThingStack",
                      "WhiteSkeleton",
                      "Dog",
                      "RedSkeleton",
                      "AxeKnight",
                      "SmallHeart",
                      "DropItem"
                  ])
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
            for (const [suite, difficulty] of baseline
                ? [
                      ["null-playback", "normal"],
                      ["null-playback", "hard"]
                  ]
                : [
                      ["null-boundary", "normal"],
                      ["null-playback", "normal"],
                      ["null-playback", "hard"]
                  ]) {
                console.log(name + ": " + suite + " " + difficulty + (baseline ? " baseline" : " corrected"));
                const page = await browser.newPage();
                const errors = [];
                page.on("pageerror", (e) => errors.push(e.message));
                await page.goto("http://127.0.0.1:" + vite.httpServer.address().port + "/browser-verify.html?suite=" + suite + "&difficulty=" + difficulty);
                await page.waitForFunction(() => ["passed", "failed"].includes(document.querySelector("#result")?.dataset.status), null, { timeout: 360000 });
                assert.equal(await page.locator("#result").getAttribute("data-status"), "passed", await page.locator("#result").textContent());
                assert.deepEqual(errors, []);
                const data = await page.evaluate((suite) => Reflect.get(window, suite === "null-boundary" ? "nullThingEvidence" : "nullPlaybackTrace"), suite);
                writeFileSync(
                    join(evidence, `stickvania-${name}-${suite}-${difficulty}-${baseline ? "baseline" : "corrected"}.json`),
                    JSON.stringify({ browser: browser.version(), suite, data })
                );
                if (!baseline && suite === "null-playback") {
                    const expected = JSON.parse(readFileSync(join(cache, `stickvania-${name}-${suite}-${difficulty}-baseline.json`), "utf8"));
                    assert.equal(expected.browser, browser.version(), "baseline browser identity");
                    const first = difference(expected.data, data);
                    assert.equal(first, "", "first baseline/candidate divergence: " + first);
                    console.log(
                        JSON.stringify({
                            browser: name,
                            difficulty,
                            boundaries: data.frames.length,
                            arcs: data.arcs.length,
                            minimumT: Math.min(...data.arcs.map((a) => a.t)),
                            maxRawG: Math.max(...data.arcs.map((a) => Math.abs(a.rawG))),
                            maxPreCapMotion: data.maxPreCapMotion,
                            velocityWouldBind: data.velocityWouldBind,
                            baselineCommit
                        })
                    );
                    writeFileSync(
                        join(evidence, `${name}-${difficulty}-replay-comparison.json`),
                        JSON.stringify({
                            baselineCommit,
                            fingerprint,
                            cache,
                            matched: true,
                            boundaries: data.frames.length,
                            arcs: data.arcs,
                            maxPreCapMotion: data.maxPreCapMotion,
                            velocityWouldBind: data.velocityWouldBind
                        })
                    );
                }
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
