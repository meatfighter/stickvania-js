import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const rootDir = process.cwd();
const mainSource = readFileSync(join(rootDir, "pwa", "src", "main.ts"), "utf8");
const gameMainSource = readFileSync(join(rootDir, "pwa", "src", "stickvania", "Main.ts"), "utf8");
const runtimeLoaderSource = readFileSync(join(rootDir, "pwa", "src", "app", "RuntimeLoader.ts"), "utf8");
const serviceWorkerSource = readFileSync(join(rootDir, "pwa", "public", "sw.js"), "utf8");
const stylesSource = readFileSync(join(rootDir, "pwa", "src", "styles.css"), "utf8");
const songSource = readFileSync(join(rootDir, "pwa", "src", "stickvania", "Song.ts"), "utf8");
const menuViewSource = readFileSync(join(rootDir, "pwa", "src", "app", "MenuView.ts"), "utf8");

test("new game requires prepared resources and destroys the old session before fresh playback activation", () => {
    const startGame = mainSource.slice(mainSource.indexOf("async function startGame"), mainSource.indexOf("async function launchPreparedGame"));
    assert.match(startGame, /const runtime = runtimeLoader\.getPreparedRuntime\(\);/);
    assert.match(startGame, /if \(runtime === null\) \{\s*startPwaMenu\(\);\s*return;\s*\}/);
    const runtimePrepared = startGame.indexOf("const runtime = runtimeLoader.getPreparedRuntime();");
    const destroyOldSession = startGame.indexOf("if (!destroyGame())");
    const beginSession = startGame.indexOf("const session = sessions.begin();");
    const shell = startGame.indexOf("viewport.createShell(session)");
    const beginAudio = startGame.indexOf("const audio = beginGameAudio();");
    const fullscreen = startGame.indexOf("requestPreferredFullscreen();");
    const firstAwait = startGame.indexOf("await audio.ready");
    assert.match(startGame, /if \(!destroyGame\(\)\) \{\s*return;\s*\}/);
    assert.ok(destroyOldSession > runtimePrepared, "old-session cleanup must happen after prepared-resource validation");
    assert.ok(beginSession > destroyOldSession, "a new session must not begin until old-session cleanup succeeds");
    assert.ok(shell > beginSession, "game shell must be owned by the new session");
    assert.ok(beginAudio > shell, "fresh playback activation must follow shell creation");
    assert.ok(fullscreen > beginAudio && firstAwait > fullscreen, "fullscreen request must stay inside the original activation before the first await");
    assert.ok(startGame.indexOf('pwaSessionState = "starting";') < beginAudio);
    assert.doesNotMatch(startGame, /unlockAudio|ensurePrepared|showBoot/);
});

test("menu launch admission is state-gated without sticky disabled buttons", () => {
    assert.doesNotMatch(menuViewSource, /disableLaunchButtons|newGameButton\.disabled\s*=\s*true|continueButton\.disabled\s*=\s*true/);

    const menuCallbacks = mainSource.slice(mainSource.indexOf("function renderMenuForParent"), mainSource.indexOf("function resetPwaState"));
    assert.match(menuCallbacks, /onNewGame:[\s\S]*?if \(!canActivateFromMenu\(\)\)/);
    assert.match(menuCallbacks, /onContinue:[\s\S]*?if \(!canActivateFromMenu\(\)\)/);
});

test("browser lifecycle only enters the PWA menu and never auto-resumes", () => {
    assert.match(mainSource, /window\.addEventListener\("pagehide", \(\) => requestPwaMenu\("pagehide"\)\)/);
    assert.match(mainSource, /window\.addEventListener\("blur", \(\) => requestPwaMenu\("blur"\)\)/);
    assert.match(mainSource, /document\.visibilityState === "hidden"/);
    assert.doesNotMatch(mainSource, /window\.addEventListener\("focus"/);
    assert.doesNotMatch(mainSource, /window\.addEventListener\("pageshow"/);
    assert.match(mainSource, /function requestPwaMenu[\s\S]*?pwaSessionState = "stopping";[\s\S]*?suspendGameForMenu\(\)/);
    assert.match(mainSource, /function suspendGameForMenu[\s\S]*?releaseGameAudio\(\)/);
});

test("graphics lifecycle is exit-only and restoration never resumes gameplay", () => {
    const launch = mainSource.slice(mainSource.indexOf("async function launchPreparedGame"), mainSource.indexOf("function refreshVisibleBootProgress"));
    assert.match(launch, /setGraphicsLifecycleHandler\(\(state\) => \{[\s\S]*?state === "lost"[\s\S]*?requestPwaMenu\("graphics-context-lost"\)/);
    assert.doesNotMatch(launch, /state === "restored"[\s\S]*?(?:setLoopSuspended\(false\)|setBrowserSuspended\(false\)|beginGameAudio\(|commitGameAudio\()/);
});

test("live-menu transition freezes rumble/gameplay and retires playback before saving", () => {
    const liveMenu = mainSource.slice(mainSource.indexOf("function showLiveMenuOverlay"), mainSource.indexOf("async function resumeLiveGameFromMenu"));
    assert.ok(liveMenu.indexOf("suspendGameForMenu();") < liveMenu.indexOf("saveCurrentGameState"));
    const suspend = mainSource.slice(mainSource.indexOf("function suspendGameForMenu"), mainSource.indexOf("function requestPwaMenu"));
    assert.match(suspend, /setLoopSuspended\(true\)/);
    assert.match(suspend, /setBrowserSuspended\(true\)/);
    assert.match(suspend, /getInput\(\)\.pause\(\)/);
    assert.match(suspend, /rumbleManager\?\.setSuspended\(true\)/);
    assert.match(suspend, /releaseGameAudio\(\)/);
});

test("live-menu presentation exits fullscreen before publishing recoverable save state", () => {
    const liveMenu = mainSource.slice(mainSource.indexOf("function showLiveMenuOverlay"), mainSource.indexOf("async function resumeLiveGameFromMenu"));
    assert.match(liveMenu, /const saved = sessionCleanup\.trySave\(saveCurrentGameState\)/);
    assert.match(liveMenu, /Progress could not be saved\. Continue still preserves this live game\./);
    const exitIndex = liveMenu.indexOf("await viewport.exitFullscreenForMenu()");
    const renderIndex = liveMenu.indexOf("menuOverlay = renderMenuForParent");
    const publishIndex = liveMenu.indexOf('pwaSessionState = "menu";');
    assert.ok(exitIndex >= 0 && renderIndex > exitIndex && publishIndex > renderIndex);
    const destroyIndex = liveMenu.indexOf("destroyGame();");
    assert.ok(destroyIndex < 0 || destroyIndex < exitIndex || destroyIndex > renderIndex, "ordinary save failure must not destroy the retained game");
});

test("ownership relinquishment performs the final save before destructive cleanup", () => {
    const release = mainSource.slice(mainSource.indexOf("function releaseOwnedSession"), mainSource.indexOf("function showCleanupFailure"));
    const save = mainSource.slice(mainSource.indexOf("function saveCurrentGameState"), mainSource.indexOf("function clearStoredGameState"));
    assert.ok(release.indexOf("sessionCleanup.trySave(saveCurrentGameState);") < release.indexOf("destroyGame();"));
    assert.match(save, /if \(!ownership\?\.owned\) \{\s*return false;\s*\}/);
});

test("Stickvania Song sequencing uses logical transport and has no browser recovery authority", () => {
    assert.match(songSource, /getTransportState\(\) !== "stopped"/);
    assert.match(songSource, /isTransportActive\(\)/);
    assert.doesNotMatch(songSource, /resumeAfterBrowserSuspension|resumeMusicPart|browser/i);
});

test("Stickvania Main no longer owns browser audio preferences or recovery", () => {
    assert.doesNotMatch(gameMainSource, /BrowserAudioController|browserAudioController|browserSuspendedMusicOn|browserSuspendedSoundOn|resumeBrowserAudio/);
    const suspension = gameMainSource.slice(gameMainSource.indexOf("public setBrowserSuspended"), gameMainSource.indexOf("public resetNextFrameTime"));
    assert.match(suspension, /this\.browserSuspended = suspended/);
    assert.match(suspension, /this\.stopAllRumbles\(\)/);
    assert.match(suspension, /this\.clearInputPressedRecords\(\)/);
    assert.doesNotMatch(suspension, /setMusicOn|setSoundOn|resume|Music|Song/);
});

test("playback and fullscreen activation are attempt-scoped for live Continue", () => {
    const resume = mainSource.slice(mainSource.indexOf("async function resumeLiveGameFromMenu"), mainSource.indexOf("function removeMenuOverlay"));
    assert.match(resume, /const audio = beginGameAudio\(\)/);
    assert.match(resume, /requestPreferredFullscreen\(\)/);
    assert.ok(resume.indexOf("requestPreferredFullscreen()") < resume.indexOf("await audio.ready"));
    assert.match(resume, /commitGameAudio\(audio\)/);
    assert.match(resume, /isGameAudioLatest\(audio\)/);
    assert.equal((resume.match(/isGameAudioLatest\(audio\)/g) ?? []).length, 2, "Continue catch and finally must both reject stale attempts.");
    assert.match(resume, /isStartingGameSession\(session, audio\)/);
});

test("synchronous post-commit viewport hooks are rechecked before RUNNING", () => {
    const launch = mainSource.slice(mainSource.indexOf("async function launchPreparedGame"), mainSource.indexOf("function refreshVisibleBootProgress"));
    const launchFocus = launch.indexOf("viewport.focusCanvas();");
    const launchGuard = launch.indexOf("if (!isStartingGameSession(session, audio) || game !== mainGame || container !== appContainer)", launchFocus);
    const launchRunning = launch.indexOf('pwaSessionState = "running";', launchFocus);
    assert.ok(launchFocus >= 0 && launchGuard > launchFocus && launchRunning > launchGuard);

    const resume = mainSource.slice(mainSource.indexOf("async function resumeLiveGameFromMenu"), mainSource.indexOf("function removeMenuOverlay"));
    const reconcile = resume.indexOf("viewport.reconcileDisplayModeNow();");
    const resumeFocus = resume.indexOf("viewport.focusCanvas();");
    const focusGuard = resume.indexOf("if (!isStartingGameSession(session, audio))", resumeFocus);
    const inputResume = resume.indexOf("liveContainer.getInput().resume();");
    const clearInput = resume.indexOf("liveGame.clearInputPressedRecords();", inputResume);
    const inputGuard = resume.indexOf("if (!isStartingGameSession(session, audio))", clearInput);
    const resumeRunning = resume.indexOf('pwaSessionState = "running";', clearInput);
    assert.ok(
        reconcile >= 0 &&
            resumeFocus > reconcile &&
            focusGuard > resumeFocus &&
            inputResume > focusGuard &&
            clearInput > inputResume &&
            inputGuard > clearInput &&
            resumeRunning > inputGuard
    );
});

test("stale container retirement uses the shared cleanup latch", () => {
    assert.match(mainSource, /function retireStaleContainer\(appContainer: AppGameContainer\): void/);
    assert.match(mainSource, /sessionCleanup\.run\(\(\) => appContainer\.destroy\(\)\)/);
    assert.match(mainSource, /if \(!sessionCleanup\.safe\) \{\s*showCleanupFailure\(\);\s*\}/);
    const launch = mainSource.slice(mainSource.indexOf("async function launchPreparedGame"), mainSource.indexOf("function refreshVisibleBootProgress"));
    assert.doesNotMatch(launch, /if \(!isStartingGameSession\(session, audio\)\) \{\s*appContainer\.destroy\(\);/);
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

test("settings rows wrap instead of compressing measured controls", () => {
    assert.match(menuViewSource, /class="settings-row settings-fullscreen-scaling-row"[\s\S]*?setting-fullscreen-row[\s\S]*?setting-scaling-row/);
    assert.match(stylesSource, /\.settings-row\s*\{[^}]*flex-wrap:\s*wrap;/s);
    assert.match(
        stylesSource,
        /\.settings-row\s*>\s*\.setting-theme-row,\s*\.settings-row\s*>\s*\.setting-scaling-row,\s*\.settings-row\s*>\s*\.setting-switch-row\s*\{[^}]*flex:\s*0\s+0\s+auto;/s
    );
});
