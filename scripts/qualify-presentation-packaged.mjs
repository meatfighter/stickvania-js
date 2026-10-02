/* global window, document, localStorage, performance */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
/** Exercise unmodified packaged shell Continue with snapshots from actual loaded producers. */
export async function qualifyPackagedPresentation(browser, checkpoints, selection = null) {
    const root = resolve(process.env.PWA_ROOT ?? "dist/pwa");
    const mime = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".webmanifest": "application/manifest+json",
        ".ogg": "audio/ogg",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".txt": "text/plain",
        ".xml": "application/xml"
    };
    const server = createServer((req, res) => {
        const pathname = new URL(req.url, "http://localhost").pathname;
        const file = resolve(root, "." + (pathname === "/" ? "/index.html" : decodeURIComponent(pathname)));
        if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) {
            res.writeHead(404).end();
            return;
        }
        res.writeHead(200, { "Content-Type": mime[extname(file)] ?? "application/octet-stream" });
        res.end(readFileSync(file));
    });
    await new Promise((done) => server.listen(0, "127.0.0.1", done));
    const context = await browser.newContext();
    const results = [];
    const errors = [];
    context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
    try {
        let page = await context.newPage();
        await page.goto(`http://127.0.0.1:${server.address().port}/`);
        await page.waitForFunction(() => window.__gameResourcesPrepared === true, null, { timeout: 120000 });
        const fullscreen = page.locator("#fullscreen-switch-button");
        if ((await fullscreen.isEnabled()) && (await fullscreen.getAttribute("aria-pressed")) === "true") await fullscreen.click();
        await page.locator("#new-game-button").click();
        const menu = async () => {
            await page.locator('button[aria-label*="menu" i]:not([hidden])').first().waitFor({ state: "visible" });
            await page.evaluate(() => {
                const b = [...document.querySelectorAll("button")].find((b) => /menu/i.test(b.getAttribute("aria-label") ?? "") && !b.hidden);
                if (!b) throw Error("Menu absent");
                b.click();
            });
            await page.locator("#continue-button").waitFor();
            return page.evaluate(() => Object.entries(localStorage).find(([key]) => key.endsWith(":game-state")));
        };
        const initial = await menu();
        assert(initial, "Packaged stable game-state slot");
        // Paused browser clock allows immediate restore/render/menu without an extra game tick.
        const selectedCheckpoints =
            selection === null
                ? checkpoints.filter((c) =>
                      /^route-floor-breaker$|^floor-map-destination$|^stair-0-0-.*-out-11$|^entry-fade11$|^tick505$|^terminal-fade11$|^credit-(0|5|11)-mid-recording$|^credit-12-first-letter$|^ending-muted-offset$/.test(
                          c.label
                      )
                  )
                : checkpoints.filter((c) => selection.includes(c.label));
        for (const checkpoint of selectedCheckpoints) {
            await page.close();
            page = await context.newPage();
            await page.addInitScript(({ key, bytes }) => localStorage.setItem(key, bytes), { key: initial[0], bytes: checkpoint.bytes });
            await page.clock.install();
            await page.goto(`http://127.0.0.1:${server.address().port}/`);
            await page.waitForFunction(() => window.__gameResourcesPrepared === true, null, { timeout: 120000 });
            await page.clock.pauseAt(Date.now() + 1000);
            await page.evaluate(() => {
                let id = 0;
                const callbacks = new Map();
                window.presentationFrames = () => {
                    const ready = [...callbacks.values()];
                    callbacks.clear();
                    for (const callback of ready) callback(performance.now());
                    return ready.length;
                };
                window.requestAnimationFrame = (callback) => {
                    callbacks.set(++id, callback);
                    return id;
                };
                window.cancelAnimationFrame = (id) => callbacks.delete(id);
            });
            const resume = async () => {
                await page.evaluate(() => document.getElementById("continue-button").click());
                for (let i = 0; i < 30; i++) await page.evaluate(() => window.presentationFrames());
            };
            await resume();
            await page.locator("canvas").waitFor();
            if (checkpoint.label === "ownerless-ended-pending") {
                // Startup can finish after resume's early callbacks (notably in
                // Firefox). Deliver an accepted outer frame after canvas entry.
                assert((await page.evaluate(() => window.presentationFrames())) > 0, "Ownerless completion receives an accepted outer frame");
            }
            const entry = await menu();
            assert(entry, "Restored save exists");
            const snapshot = JSON.parse(entry[1]),
                expected = JSON.parse(checkpoint.bytes);
            assert.notEqual(snapshot.appVersion, expected.appVersion, checkpoint.label + " packaged writer replaced fixture bytes");
            assert.equal(snapshot.version, 26);
            assert.equal(snapshot.mode, expected.mode, checkpoint.label + " restores actual scene");
            assert.equal(snapshot.mainFields.creditsIndex, expected.mainFields.creditsIndex);
            assert.equal(snapshot.mainFields.recordingIndex, expected.mainFields.recordingIndex);
            assert.equal(snapshot.mainFields.castleCrumbleRumbleTicks, expected.mainFields.castleCrumbleRumbleTicks);
            assert.equal(snapshot.audio.currentSong, expected.audio.currentSong, checkpoint.label + " current Song");
            assert.equal(snapshot.audio.requestedSong, expected.audio.requestedSong, checkpoint.label + " requested Song");
            assert.equal(snapshot.audio.currentMusic?.id ?? null, expected.audio.currentMusic?.id ?? null);
            if (checkpoint.label === "ownerless-ended-pending") {
                assert.equal(expected.audio.currentSong, null);
                assert.equal(expected.audio.requestedSong, null);
                assert.equal(expected.audio.currentMusic, null);
                assert(expected.audio.songs.some((song) => [song.intro, song.loop].some((part) => part?.playback.transport === "ended-pending")));
                assert(expected.audio.songs.every((song) => !song.playing));
                // Constant-time RAF still calls Music.poll(0) before Main.update.
                // Cold restore preserves this completion; the first outer poll
                // consumes it without starting a Song or advancing gameplay.
                const fields = (value) => {
                    const copy = { ...value };
                    delete copy.nextFrameTime;
                    return copy;
                };
                assert.deepEqual(fields(snapshot.mainFields), fields(expected.mainFields), "Ownerless poll does not simulate");
                for (const key of ["random", "stage"]) assert.deepEqual(snapshot[key], expected[key], "Ownerless poll preserves " + key);
                const expectedThings = structuredClone(expected.things);
                // The shell deliberately rearms Simon's release gates on Continue.
                // This is input-session cleanup, independent of simulation ticks.
                const simon = expectedThings.find((thing) => thing.type === "Simon");
                for (const key of ["releasedJump", "releasedKneel", "releasedWhip"]) simon.fields[key] = false;
                assert.deepEqual(snapshot.things, expectedThings, "Ownerless poll preserves actors apart from explicit input rearming");
            }
            for (const song of expected.audio.songs) {
                const actual = snapshot.audio.songs.find((s) => s.id === song.id);
                assert.equal(actual.playing, song.playing, checkpoint.label + " Song ownership " + song.id);
                for (const part of ["intro", "loop"]) {
                    assert.equal(
                        actual[part]?.playback.transport ?? null,
                        checkpoint.label === "ownerless-ended-pending" && song[part]?.playback.transport === "ended-pending"
                            ? "stopped"
                            : (song[part]?.playback.transport ?? null),
                        checkpoint.label + " Song transport " + song.id
                    );
                }
            }
            if (expected.audio.currentMusic !== null)
                assert.equal(snapshot.audio.currentMusic.playback.transport, expected.audio.currentMusic.playback.transport);
            await resume();
            await page.locator("canvas").waitFor();
            const retained = JSON.parse((await menu())[1]);
            assert.deepEqual(retained.mainFields, snapshot.mainFields, "Retained packaged menu preserves presentation");
            if (checkpoint.label === "ending-muted-offset") {
                const ending = retained.audio.songs.find((song) => song.id === "ending").loop.playback;
                assert.equal(ending.volume, 0);
                assert(ending.positionSeconds >= 0.125, "Ending offset survives shell generation replacement");
            }
            results.push(checkpoint.label);
        }
        assert.equal(results.length, selection === null ? 14 : selection.length, "All packaged presentation checkpoints exercised");
        assert.deepEqual(errors, []);
        return results;
    } finally {
        await context.close();
        await new Promise((done) => server.close(done));
    }
}
