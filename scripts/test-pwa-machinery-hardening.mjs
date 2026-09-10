import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const rootDir = process.cwd();
const mainSource = readFileSync(join(rootDir, "pwa", "src", "main.ts"), "utf8");
const runtimeLoaderSource = readFileSync(join(rootDir, "pwa", "src", "app", "RuntimeLoader.ts"), "utf8");
const serviceWorkerSource = readFileSync(join(rootDir, "pwa", "public", "sw.js"), "utf8");
const stylesSource = readFileSync(join(rootDir, "pwa", "src", "styles.css"), "utf8");
const songSource = readFileSync(join(rootDir, "pwa", "src", "stickvania", "Song.ts"), "utf8");

test("new game requires prepared resources and destroys the old session before fresh audio activation", () => {
    const startGame = mainSource.slice(mainSource.indexOf("async function startGame"), mainSource.indexOf("async function launchPreparedGame"));
    assert.match(startGame, /const runtime = runtimeLoader\.getPreparedRuntime\(\);/);
    assert.match(startGame, /if \(runtime === null\) \{\s*startPwaMenu\(\);\s*return;\s*\}/);
    assert.ok(startGame.indexOf("destroyGame();") > startGame.indexOf("const runtime = runtimeLoader.getPreparedRuntime();"));
    assert.ok(startGame.indexOf("destroyGame();") < startGame.indexOf("const audioUnlockPromise = unlockAudio();"));
    assert.doesNotMatch(startGame, /ensurePrepared|showBoot/);
    assert.match(startGame, /pwaSessionState !== "menu"/);
    assert.match(startGame, /pwaSessionState = "starting"/);
});

test("browser lifecycle only enters the PWA menu and never auto-resumes", () => {
    assert.match(mainSource, /window\.addEventListener\("pagehide", \(\) => requestPwaMenu\("pagehide"\)\)/);
    assert.match(mainSource, /window\.addEventListener\("blur", \(\) => requestPwaMenu\("blur"\)\)/);
    assert.match(mainSource, /document\.visibilityState === "hidden"/);
    assert.doesNotMatch(mainSource, /window\.addEventListener\("focus"/);
    assert.doesNotMatch(mainSource, /window\.addEventListener\("pageshow"/);
    assert.match(mainSource, /if \(pwaSessionState === "starting"\) \{[\s\S]*showMenu\(\);[\s\S]*return;/);
    assert.match(mainSource, /pwaSessionState === "running"[\s\S]*game\.isLiveMenuOverlayAllowed\(\)/);
    assert.match(mainSource, /releaseGameAudio\(\);[\s\S]*menuOverlay = renderMenuForParent/);
});

test("live-menu transition freezes gameplay before saving and retiring audio", () => {
    const liveMenu = mainSource.slice(mainSource.indexOf("function showLiveMenuOverlay"), mainSource.indexOf("async function resumeLiveGameFromMenu"));
    assert.ok(liveMenu.indexOf("game.setBrowserSuspended(true);") < liveMenu.indexOf("const saved = saveCurrentGameState();"));
    assert.ok(liveMenu.indexOf("container.setLoopSuspended(true);") < liveMenu.indexOf("const saved = saveCurrentGameState();"));
    assert.ok(liveMenu.indexOf("const saved = saveCurrentGameState();") < liveMenu.indexOf("releaseGameAudio();"));
});

test("Stickvania Song recovery never chooses or starts a replacement music segment", () => {
    const resume = songSource.slice(songSource.indexOf("public resumeAfterBrowserSuspension"), songSource.indexOf("private resumeMusicPart"));
    assert.match(resume, /this\.resumeMusicPart\(this\.intro\)/);
    assert.match(resume, /this\.resumeMusicPart\(this\.loop\)/);
    assert.doesNotMatch(resume, /\.play\(|\.loop\(/);
});

test("runtime preload waits for both resource branches before exposing failure", () => {
    assert.match(runtimeLoaderSource, /const results = await Promise\.allSettled\(\[/);
    assert.match(runtimeLoaderSource, /results\.find\(\(result\): result is PromiseRejectedResult => result\.status === "rejected"\)/);
    assert.match(runtimeLoaderSource, /if \(failure !== undefined\) \{\s*throw failure\.reason;\s*\}/);
    assert.match(runtimeLoaderSource, /if \(signal\.aborted\) \{\s*throw signal\.reason/);
    assert.doesNotMatch(
        runtimeLoaderSource,
        /await Promise\.all\(\[\s*ResourceLoader\.preloadResources[\s\S]*?SoundStore\.get\(\)\.preloadAudioBuffers/,
        "Audio and non-audio preload branches must not fail-fast and leave sibling work running behind a retry screen."
    );
});

test("service worker treats HTTP failures like network failures", () => {
    assert.match(serviceWorkerSource, /async function fetchOnce\(request\)/);
    assert.match(serviceWorkerSource, /if \(!response\.ok\) \{\s*throw new Error\(`HTTP \$\{response\.status\}`\);\s*\}/);
    assert.match(serviceWorkerSource, /event\.respondWith\(fetchOnce\(request\)\.catch\(/);
    assert.match(serviceWorkerSource, /return cached \|\| fetchOnce\(request\);/);
    assert.doesNotMatch(serviceWorkerSource, /event\.respondWith\(fetch\(request\)\.catch\(/);
});

test("theme and rumble settings wrap instead of compressing the measured theme picker", () => {
    assert.match(stylesSource, /\.settings-row\s*\{[^}]*flex-wrap:\s*wrap;/s);
    assert.match(stylesSource, /\.settings-row\s*>\s*\.setting-theme-row,\s*\.settings-row\s*>\s*\.setting-switch-row\s*\{[^}]*flex:\s*0\s+0\s+auto;/s);
});
