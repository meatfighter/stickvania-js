import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const rootDir = process.cwd();
const mainSource = readFileSync(join(rootDir, "pwa", "src", "main.ts"), "utf8");
const gameMainSource = readFileSync(join(rootDir, "pwa", "src", "stickvania", "Main.ts"), "utf8");
const inputConfigSource = readFileSync(join(rootDir, "pwa", "src", "stickvania", "InputConfigMode.ts"), "utf8");
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
    const destroyOldSession = startGame.indexOf("if (!destroyGame()) return;");
    const beginSession = startGame.indexOf("const session = sessions.begin();");
    const shell = startGame.indexOf("viewport.createShell(session)");
    const beginAudio = startGame.indexOf("audio = beginGameAudio();");
    const fullscreen = startGame.indexOf("requestPreferredFullscreen();");
    const firstAwait = startGame.indexOf("await audio.ready");

    assert.ok(destroyOldSession > runtimePrepared, "old-session cleanup must happen after prepared-resource validation");
    assert.ok(beginSession > destroyOldSession, "a new session must not begin until old-session cleanup succeeds");
    assert.ok(shell > beginSession, "game shell must be owned by the new session");
    assert.ok(beginAudio > shell, "fresh playback activation must follow shell creation");
    assert.ok(fullscreen > beginAudio && firstAwait > fullscreen, "fullscreen request must stay inside the original activation before the first await");
    const startingState = startGame.indexOf('pwaSessionState = "starting";');
    assert.ok(startingState >= 0 && beginAudio > startingState);
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

test("live-menu retention has no mode-specific Input Config exclusion", () => {
    assert.doesNotMatch(gameMainSource, /isLiveMenuOverlayAllowed/);
    const canOpen = mainSource.slice(mainSource.indexOf("function canOpenLiveMenuOverlay"), mainSource.indexOf("function hasLiveSuspendedGame"));
    assert.doesNotMatch(canOpen, /MODE_INPUT_CONFIG|inputConfig|isLiveMenuOverlayAllowed/);
});

test("live-menu transition freezes rumble/gameplay and retires playback before saving", () => {
    const liveMenu = mainSource.slice(mainSource.indexOf("function showLiveMenuOverlay"), mainSource.indexOf("async function resumeLiveGameFromMenu"));
    const suspendIndex = liveMenu.indexOf("suspendGameForMenu()");
    const saveIndex = liveMenu.indexOf("saveCurrentGameState");
    assert.ok(suspendIndex >= 0 && saveIndex > suspendIndex);
    const suspend = mainSource.slice(mainSource.indexOf("function suspendGameForMenu"), mainSource.indexOf("function requestPwaMenu"));
    assert.match(suspend, /setLoopSuspended\(true\)/);
    assert.match(suspend, /setBrowserSuspended\(true\)/);
    assert.match(suspend, /getInput\(\)\.pause\(\)/);
    assert.match(suspend, /rumbleManager\?\.setSuspended\(true\)/);
    assert.match(suspend, /releaseGameAudio\(\)/);
});

test("live-menu presentation exits fullscreen before publishing a quiet retained menu", () => {
    const liveMenu = mainSource.slice(mainSource.indexOf("function showLiveMenuOverlay"), mainSource.indexOf("async function resumeLiveGameFromMenu"));
    assert.match(liveMenu, /trySave\(saveCurrentGameState\)/);
    assert.doesNotMatch(liveMenu, /Progress could not be saved|const saved =/);
    const exitIndex = liveMenu.indexOf("await viewport.exitFullscreenForMenu()");
    const renderIndex = liveMenu.indexOf("menuOverlay =");
    const publishIndex = liveMenu.indexOf('pwaSessionState = "menu";');
    assert.ok(exitIndex >= 0 && renderIndex > exitIndex && publishIndex > renderIndex);
});

test("title default-mapping reset uses one shell-owned persistence path", () => {
    const selectTitle = gameMainSource.slice(
        gameMainSource.indexOf("private selectTitleMenuOption"),
        gameMainSource.indexOf("private setTitleMenu", gameMainSource.indexOf("private selectTitleMenuOption"))
    );
    assert.match(selectTitle, /notifyInputMappingChanged\(\)/);
    assert.doesNotMatch(selectTitle, /notifyInputMappingChanged\(true\)|\.save\(/);
    assert.match(selectTitle, /mappingResetResults\.set/);

    const setTitleMenu = gameMainSource.slice(
        gameMainSource.indexOf("private setTitleMenu(menu: number, selectedIndex: number = 0)"),
        gameMainSource.indexOf("private renderTitleMainMenu")
    );
    assert.match(setTitleMenu, /this\.titleMenu === Main\.TITLE_MENU_INPUT && menu !== Main\.TITLE_MENU_INPUT[\s\S]*?mappingResetResults\.delete\(this\)/);
});

test("difficulty and browser preference persistence is shell-owned", () => {
    const difficultyStart = gameMainSource.indexOf("public setDifficulty(difficulty: number): void");
    const difficultyEnd = gameMainSource.indexOf("public override init", difficultyStart);
    const difficulty = gameMainSource.slice(difficultyStart, difficultyEnd);

    assert.match(difficulty, /Main\.difficultyChangedHandlers\.get\(this\)\?\.\(this\.difficulty\)/);
    assert.doesNotMatch(difficulty, /localStorage|DIFFICULTY_STORAGE_KEY/);
    assert.doesNotMatch(gameMainSource, /DIFFICULTY_STORAGE_KEY/);

    const launch = mainSource.slice(mainSource.indexOf("async function launchPreparedGame"), mainSource.indexOf("appContainer.setAlwaysRender"));
    assert.match(launch, /mainGame\.difficulty = preferences\.difficulty/);
    assert.match(launch, /mainGame\.setDifficultyChangedHandler\(\(difficulty\) =>/);
    assert.match(launch, /preferences\.setDifficulty\(\s*difficulty,\s*\(\) => ownership\.owned && isCurrentGameSession\(session\) && game === mainGame\s*\)/s);

    assert.match(mainSource, /preferences\.setVolume\(value, persist, currentPreferenceWriteAuthorized\)/);
    assert.match(mainSource, /preferences\.setDisplayMode\(value, currentPreferenceWriteAuthorized\)/);
    assert.match(mainSource, /preferences\.setScaling\(value, currentPreferenceWriteAuthorized\)/);
    assert.match(mainSource, /preferences\.setRumbleEnabled\(value, currentPreferenceWriteAuthorized\)/);
    assert.match(mainSource, /preferences\.setFullscreen\(value, currentPreferenceWriteAuthorized\)/);

    const reset = mainSource.slice(mainSource.indexOf("function resetPwaState"), mainSource.indexOf("async function startGame"));
    assert.match(reset, /const epoch = ownership\.epoch/);
    assert.match(reset, /preferences\.reset\(\(\) => ownership\.isCurrent\(epoch\)\)/);
    assert.match(reset, /if \(!ownership\.isCurrent\(epoch\)\) return;/);
    assert.doesNotMatch(reset, /refreshOwnedSettings|preferences\.reload|ButtonMapping\.load/);
});

test("input mapping persistence is shell-owned and rechecks the current session at write time", () => {
    assert.match(inputConfigSource, /this\.main\.notifyInputMappingChanged\(\)\.saved/);
    assert.doesNotMatch(inputConfigSource, /buttonMapping\.save\(/);

    assert.match(gameMainSource, /private static readonly inputMappingChangedHandlers = new WeakMap<Main, \(\) => MappingWriteResult>\(\)/);
    assert.match(gameMainSource, /public setInputMappingChangedHandler\(handler: \(\(\) => MappingWriteResult\) \| null\): void/);
    assert.match(gameMainSource, /public notifyInputMappingChanged\(\): MappingWriteResult/);
    assert.doesNotMatch(gameMainSource, /replaceProtected/);

    const launch = mainSource.slice(mainSource.indexOf("async function launchPreparedGame"), mainSource.indexOf("appContainer.setAlwaysRender"));

    assert.match(launch, /mainGame\.setInputMappingChangedHandler\(\(\) => \{/);
    assert.match(launch, /if \(!isCurrentGameSession\(session\) \|\| game !== mainGame\) return \{ saved: false, reason: "stale-session" \}/);
    assert.match(launch, /sessionMapping\.copyFrom\(mainGame\.buttonMapping\)/);
    assert.match(launch, /sessionMapping\.save\(\(\) => isCurrentGameSession\(session\) && game === mainGame\)/);
    assert.doesNotMatch(launch, /replaceProtected/);
});

test("New Game game-state removal rechecks ownership at the storage boundary", () => {
    const clear = mainSource.slice(mainSource.indexOf("function clearStoredGameState"), mainSource.indexOf("function syncScreenWakeLock"));
    assert.match(clear, /if \(!currentPreferenceWriteAuthorized\(\)\) \{\s*return;\s*\}/);
    assert.match(clear, /store\.clear\(currentPreferenceWriteAuthorized\)/);
    assert.equal((clear.match(/currentPreferenceWriteAuthorized\(\)/g) ?? []).length, 1);
    assert.match(clear, /removePreference\("Stickvania saved game", GAME_STATE_STORAGE_KEY, currentPreferenceWriteAuthorized\)/);
    assert.doesNotMatch(clear, /localStorage\.removeItem/);
});

test("ownership relinquishment performs the final save before destructive cleanup", () => {
    const release = mainSource.slice(mainSource.indexOf("function releaseOwnedSession"), mainSource.indexOf("function showCleanupFailure"));
    const releaseSaveIndex = release.indexOf("trySave(saveCurrentGameState)");
    const releaseDestroyIndex = release.indexOf("destroyGame()");
    assert.ok(releaseSaveIndex >= 0 && releaseDestroyIndex > releaseSaveIndex);
    const save = mainSource.slice(mainSource.indexOf("function saveCurrentGameState"), mainSource.indexOf("function clearStoredGameState"));
    assert.match(save, /ownership/);
    assert.match(save, /persistence\.canSave\(mainGame\)/);
    assert.doesNotMatch(save, /canReadStored|inspectStored|hasValidSave/);
});

test("Stickvania Song sequencing uses logical transport and has no browser recovery authority", () => {
    assert.match(songSource, /getTransportState\(\) !== "stopped"/);
    assert.match(songSource, /isTransportActive\(\)/);
    assert.doesNotMatch(songSource, /resumeAfterBrowserSuspension|resumeMusicPart|browser/i);
});

test("human gameplay entry rebaselines held browser/menu actions", () => {
    const transitionStart = gameMainSource.indexOf("case Main.FADE_REASON_RESTORE_CHECKPOINT");
    const transitionEnd = gameMainSource.indexOf("case Main.FADE_REASON_SHOW_MAP", transitionStart);
    const transition = gameMainSource.slice(transitionStart, transitionEnd);

    assert.match(transition, /this\.mode = Main\.MODE_PLAYING/);
    assert.match(transition, /this\.createStage\(this\.stageIndex, false\)/);
    assert.match(transition, /this\.clearInputPressedRecords\(\)/);
    assert.match(transition, /this\.simon\?\.resetInputReleaseLatches\(\)/);

    const suspension = gameMainSource.slice(gameMainSource.indexOf("public setBrowserSuspended"), gameMainSource.indexOf("public resetNextFrameTime"));
    assert.match(suspension, /this\.mode == Main\.MODE_PLAYING/);
    assert.match(suspension, /this\.simon\?\.resetInputReleaseLatches\(\)/);
});

test("Stickvania Main no longer owns browser audio preferences or recovery", () => {
    assert.doesNotMatch(gameMainSource, /BrowserAudioController|browserAudioController|browserSuspendedMusicOn|browserSuspendedSoundOn|resumeBrowserAudio/);
    const suspension = gameMainSource.slice(gameMainSource.indexOf("public setBrowserSuspended"), gameMainSource.indexOf("public resetNextFrameTime"));
    assert.match(suspension, /this\.browserSuspended = suspended/);
    assert.match(suspension, /this\.stopAllRumbles\(\)/);
    assert.match(suspension, /this\.clearInputPressedRecords\(\)/);
    assert.match(suspension, /if \(!suspended\)/);
    assert.match(suspension, /this\.mode == Main\.MODE_PLAYING/);
    assert.match(suspension, /this\.simon\?\.resetInputReleaseLatches\(\)/);
    assert.match(suspension, /this\.mode == Main\.MODE_INPUT_CONFIG/);
    assert.match(suspension, /this\.inputConfigMode\?\.resyncControllerStateAfterBrowserResume\(\)/);
    assert.doesNotMatch(suspension, /setMusicOn|setSoundOn|resumeMusic|Music|Song/);
});

test("playback and fullscreen activation are attempt-scoped for live Continue", () => {
    const resume = mainSource.slice(mainSource.indexOf("async function resumeLiveGameFromMenu"), mainSource.indexOf("function removeMenuOverlay"));
    assert.match(resume, /audio = beginGameAudio\(\)/);
    assert.match(resume, /requestPreferredFullscreen\(\)/);
    const fullscreenRequest = resume.indexOf("requestPreferredFullscreen()");
    const audioReady = resume.indexOf("await audio.ready");
    assert.ok(fullscreenRequest >= 0 && audioReady > fullscreenRequest);
    assert.match(resume, /commitGameAudio\(audio\)/);
    assert.match(resume, /isGameAudioLatest\(audio\)/);
    assert.equal((resume.match(/isGameAudioLatest\(audio\)/g) ?? []).length, 2, "Continue catch and finally must both reject stale attempts.");
    assert.match(resume, /isStartingGameSession\(session, audio\)/);
});

test("synchronous post-commit viewport hooks are rechecked before RUNNING", () => {
    const launch = mainSource.slice(mainSource.indexOf("async function launchPreparedGame"), mainSource.indexOf("function refreshVisibleBootProgress"));
    const launchPause = launch.indexOf("appContainer.getInput().pause();");
    const launchStart = launch.indexOf("await initializeWithDeadline(appContainer.start(), sessionCleanup, initializationOwner);");
    const launchFocus = launch.indexOf("viewport.focusCanvas();");
    const launchGuard = launch.indexOf("if (!isStartingGameSession(session, audio) || game !== mainGame || container !== appContainer)", launchFocus);
    const launchResume = launch.indexOf("appContainer.getInput().resume();", launchGuard);
    const launchRunning = launch.indexOf('pwaSessionState = "running";', launchResume);
    const launchUnsuspend = launch.indexOf("mainGame.setBrowserSuspended(false);", launchRunning);
    assert.ok(
        launchPause >= 0 &&
            launchStart > launchPause &&
            launchFocus > launchStart &&
            launchGuard > launchFocus &&
            launchResume > launchGuard &&
            launchRunning > launchResume &&
            launchUnsuspend > launchRunning
    );

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

test("failed Continue candidates are rejected and stale candidates are contained before publication", () => {
    const startGame = mainSource.slice(mainSource.indexOf("async function startGame"), mainSource.indexOf("async function launchPreparedGame"));

    assert.match(startGame, /const restoreAttempt = new RestoreAttempt\(\)/);
    assert.match(startGame, /await launchPreparedGame\(runtime, restoreSavedGame, session, audio, restoreAttempt\)/);
    assert.match(startGame, /if \(restoreAttempt\.rejected\) \{\s*persistence\.rejectStored\(\);\s*showMenu\(\);\s*\}/);
    assert.doesNotMatch(startGame, /Unable to restore the saved game/);

    const launch = mainSource.slice(mainSource.indexOf("async function launchPreparedGame"), mainSource.indexOf("function refreshVisibleBootProgress"));

    assert.match(launch, /if \(!getGameStateStore\(runtime\)\.restore\(mainGame, gc\)\) restoreAttempt\.reject\(\)/);

    const start = launch.indexOf("await initializeWithDeadline(appContainer.start(), sessionCleanup, initializationOwner);");
    const staleGuard = launch.indexOf("if (!isStartingGameSession(session, audio))", start);
    const staleRetire = launch.indexOf("retireStaleContainer(appContainer);", staleGuard);
    const accept = launch.indexOf("persistence.accept(mainGame);");

    assert.ok(start >= 0 && staleGuard > start && staleRetire > staleGuard);
    assert.ok(accept > staleRetire, "candidate must not become save-authoritative until after stale-session containment");

    const showMenu = mainSource.slice(mainSource.indexOf("function showMenu"), mainSource.indexOf("function renderRootMenu"));
    assert.match(showMenu, /if \(!ownership\?\.isCurrent\(ownership\.epoch\)\) \{\s*return;\s*\}/);
    assert.match(showMenu, /if \(!destroyGame\(\)\) \{\s*return;\s*\}/);

    const retire = mainSource.slice(mainSource.indexOf("function retireStaleContainer"), mainSource.indexOf("function requestPreferredFullscreen"));
    assert.match(retire, /sessionCleanup\.run\(\(\) => appContainer\.destroy\(\)\)/);
    assert.doesNotMatch(retire, /\bgame\s*=|\bcontainer\s*=|destroyGame\(/);
});

test("stale container retirement uses the shared cleanup latch", () => {
    assert.match(mainSource, /function retireStaleContainer\(appContainer: AppGameContainer\): void/);
    assert.match(mainSource, /sessionCleanup\.run\(\(\) => appContainer\.destroy\(\)\)/);
    assert.match(mainSource, /if \(!sessionCleanup\.safe\) \{\s*showCleanupFailure\(\);\s*\}/);
    const launch = mainSource.slice(mainSource.indexOf("async function launchPreparedGame"), mainSource.indexOf("function refreshVisibleBootProgress"));
    assert.doesNotMatch(launch, /if \(!isStartingGameSession\(session, audio\)\) \{\s*appContainer\.destroy\(\);/);
});

test("runtime preload observes both settled batches and aborts on first failure", () => {
    assert.match(runtimeLoaderSource, /await Promise\.all\(\[/);
    assert.match(runtimeLoaderSource, /runSettledBatch\(resources, RESOURCE_PRELOAD_CONCURRENCY, runRequired\)/);
    assert.match(runtimeLoaderSource, /runSettledBatch\(audio, AUDIO_PRELOAD_CONCURRENCY, runRequired\)/);
    assert.match(runtimeLoaderSource, /controller\.abort\(error\)/);
    assert.match(runtimeLoaderSource, /if \(failed\) throw firstFailure/);
});

test("service worker routes bounded navigation and discards failed response bodies", () => {
    assert.match(serviceWorkerSource, /serveNavigation\(request\)/);
    assert.match(serviceWorkerSource, /discardResponse\(response\)/);
    assert.match(serviceWorkerSource, /return cached \|\| fetchOnce\(request\);/);
});

test("settings rows wrap instead of compressing measured controls", () => {
    assert.match(menuViewSource, /class="settings-row settings-fullscreen-scaling-row"[\s\S]*?setting-fullscreen-row[\s\S]*?setting-scaling-row/);
    assert.match(stylesSource, /\.settings-row\s*\{[^}]*flex-wrap:\s*wrap;/s);
    assert.match(
        stylesSource,
        /\.settings-row\s*>\s*\.setting-theme-row,\s*\.settings-row\s*>\s*\.setting-scaling-row,\s*\.settings-row\s*>\s*\.setting-switch-row\s*\{[^}]*flex:\s*0\s+0\s+auto;/s
    );
});
