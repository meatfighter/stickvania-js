import { sourceMember } from "./persistence-test-loader.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(relativePath) {
    return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

const buttonMapping = read("pwa/src/stickvania/ButtonMapping.ts");
const translatedMain = read("pwa/src/stickvania/Main.ts");
const webApp = read("pwa/src/main.ts").replace(/^ {4}/gm, "");
const viewport = read("pwa/src/app/GameViewportController.ts");
const preferences = read("pwa/src/app/BrowserPreferences.ts");
const menuView = read("pwa/src/app/MenuView.ts");
const styles = read("pwa/src/styles.css");

test("Space is remappable while Escape remains browser-reserved", () => {
    const reservedKeyBody = buttonMapping.match(/public static isReservedKey\(key: number\): boolean \{([\s\S]*?)\n {4}\}/)?.[1] ?? "";
    assert.match(reservedKeyBody, /Input\.KEY_ESCAPE/);
    assert.doesNotMatch(reservedKeyBody, /Input\.KEY_SPACE/);

    const reservedHandler = webApp.match(/const handleBrowserReservedKey[\s\S]*?\n\};/)?.[0] ?? "";
    assert.match(reservedHandler, /event\.key === "Escape"/);
    assert.match(reservedHandler, /requestPwaMenu\("escape"\)/);
    assert.doesNotMatch(reservedHandler, /event\.code === "Space"|event\.key === " "/);
});

test("translated browser game no longer owns fullscreen or legacy cursor fullscreen machinery", () => {
    assert.doesNotMatch(translatedMain, /BrowserFullscreenController|browserFullscreenController/);
    assert.doesNotMatch(translatedMain, /SPACE - FULL-SCREEN MODE/);
    assert.doesNotMatch(translatedMain, /requestFullscreen\(|exitFullscreen\(/);
    assert.doesNotMatch(translatedMain, /nativeCursor|showMouseCursor|hideMouseCursor|CursorLoader|BufferUtils|Mouse\./);
});

test("fullscreen preference defaults on, presents unavailable as off, and is independent of rumble", () => {
    assert.match(preferences, /DEFAULT_FULLSCREEN_PREFERENCE\s*=\s*true/);
    assert.match(preferences, /getBrowserStorageKey\("fullscreen"\)/);
    assert.match(preferences, /this\.fullscreen = DEFAULT_FULLSCREEN_PREFERENCE/);
    assert.match(menuView, /const fullscreenPresented = !state\.fullscreenUnavailable && currentFullscreen/);
    assert.match(menuView, /class="menu-switch fullscreen-switch"/);
    assert.match(menuView, /disabled title="Fullscreen is unavailable in this browser"/);
    assert.match(menuView, /const presented = !button\.disabled && enabled/);
    assert.match(styles, /\.fullscreen-switch:disabled\s*\{[^}]*border-color:\s*#555555;[^}]*background:\s*#555555;[^}]*opacity:\s*1;/s);
    assert.match(styles, /\.fullscreen-switch:disabled span\s*\{[^}]*background:\s*#111111;[^}]*transform:\s*translateX\(0\);/s);
    assert.doesNotMatch(styles, /\.menu-switch:disabled\s*\{/);
});

test("New Game and retained Continue request fullscreen before the first await", () => {
    const coldStart = webApp.match(/async function startGame\([\s\S]*?\n}\n\nasync function launchPreparedGame/)?.[0] ?? "";
    const coldShell = coldStart.indexOf("viewport.createShell(session)");
    const coldAudio = coldStart.indexOf("audio = beginGameAudio();");
    const coldFullscreen = coldStart.indexOf("requestPreferredFullscreen();");
    const coldAwait = coldStart.indexOf("await audio.ready");
    assert.ok(coldShell >= 0 && coldAudio > coldShell && coldFullscreen > coldAudio && coldAwait > coldFullscreen);

    const liveContinue =
        webApp.match(/async function resumeLiveGameFromMenu\([\s\S]*?\n}\n\nasync function restoreExistingLiveMenuAfterInterruptedResume/)?.[0] ?? "";
    const liveAudio = liveContinue.indexOf("audio = beginGameAudio();");
    const liveFullscreen = liveContinue.indexOf("requestPreferredFullscreen();");
    const liveAwait = liveContinue.indexOf("await audio.ready");
    assert.ok(liveAudio >= 0 && liveFullscreen > liveAudio && liveAwait > liveFullscreen);
});

test("menu publication is behind exact-shell fullscreen exit", () => {
    const liveMenu = webApp.match(/async function showLiveMenuOverlay\([\s\S]*?\n}\n\nasync function resumeLiveGameFromMenu/)?.[0] ?? "";
    assert.match(liveMenu, /await finishLiveMenuPresentation\(session, null\)/);
    const presenter = sourceMember("pwa/src/main.ts", "finishLiveMenuPresentation");
    const exit = presenter.indexOf("await viewport.exitFullscreenForMenu()");
    const render = presenter.indexOf("renderMenuForParent(app", exit);
    assert.ok(exit >= 0 && render > exit);

    const interrupted = webApp.match(/async function restoreExistingLiveMenuAfterInterruptedResume\([\s\S]*?\n}\n\nfunction removeMenuOverlay/)?.[0] ?? "";
    assert.match(interrupted, /await finishLiveMenuPresentation\(session, overlay\)/);
    const interruptedExit = presenter.indexOf("await viewport.exitFullscreenForMenu()");
    const menuState = presenter.indexOf('pwaSessionState = "menu"', interruptedExit);
    assert.ok(interruptedExit >= 0 && menuState > interruptedExit);
});

test("fullscreen authority is fenced to one presentation and one active request", () => {
    assert.match(viewport, /private presentationGeneration = 0/);
    assert.match(viewport, /private fullscreenEntryAuthorized = false/);
    assert.match(viewport, /private fullscreenSuppressedPresentation: number \| null = null/);
    assert.match(viewport, /private readonly pendingFullscreenRequests = new Set<PendingFullscreenRequest>/);
    assert.match(viewport, /private readonly retiredFullscreenShells = new WeakSet<HTMLElement>/);
    assert.match(viewport, /requestSerial === this\.fullscreenRequestSerial/);
    assert.match(viewport, /presentation === this\.presentationGeneration/);
    assert.match(viewport, /this\.callbacks\.isSessionCurrent\(session\)/);
    assert.match(viewport, /this\.callbacks\.isGameplayActive\(\)/);
});

test("MENU exit starts actual exit before bounded pending-entry wait", () => {
    assert.match(viewport, /FULLSCREEN_REQUEST_SETTLE_TIMEOUT_MS = 1500/);
    const exitForPresentation = viewport.match(/private async exitFullscreenForPresentation\([\s\S]*?\n    }/)?.[0] ?? "";
    const actualExit = exitForPresentation.indexOf("this.requestExitForSpecificShell(targetShell)");
    const pendingWait = exitForPresentation.indexOf("this.waitForPendingFullscreenRequests(targetShell, targetPresentation)");
    assert.ok(actualExit >= 0 && pendingWait > actualExit);
    assert.match(exitForPresentation, /this\.fullscreenRequestSerial\+\+/);
    assert.match(exitForPresentation, /this\.fullscreenEntryAuthorized = false/);
});

test("late or retired fullscreen entry is hidden and exact-shell retired", () => {
    assert.match(viewport, /retiredFullscreenShells\.has\(fullscreenElement as HTMLElement\)/);
    assert.match(viewport, /private hideRootUntilRetiredShellExits/);
    assert.match(viewport, /this\.root\.style\.visibility = "hidden"/);
    assert.match(viewport, /requestExitForSpecificShell\(shell\)/);
});

test("retained Continue reconciles presentation before input and loop resume", () => {
    const liveContinue =
        webApp.match(/async function resumeLiveGameFromMenu\([\s\S]*?\n}\n\nasync function restoreExistingLiveMenuAfterInterruptedResume/)?.[0] ?? "";
    const reconcile = liveContinue.indexOf("viewport.reconcileDisplayModeNow();");
    const inputResume = liveContinue.indexOf("liveContainer.getInput().resume();");
    const loopResume = liveContinue.indexOf("liveContainer.setLoopSuspended(false);");
    assert.ok(reconcile >= 0 && inputResume > reconcile && loopResume > inputResume);
    assert.match(viewport, /queueMicrotask\(\(\) => this\.reconcileDisplayModeNow\(\)\)/);
    assert.match(viewport, /"fullscreenchange", "webkitfullscreenchange"/);
});

test("native fullscreen remains fenced across synchronous browser reentry", () => {
    const start = viewport.indexOf("public requestFullscreen(): Promise<boolean> {");
    const end = viewport.indexOf("\n    public exitFullscreenForMenu", start);
    const request = viewport.slice(start, end);

    const preflightSession = request.indexOf("!this.callbacks.isSessionCurrent(session)");
    const preflightActivity = request.indexOf("!this.callbacks.isGameplayActive()");
    const nativeRequest = request.indexOf("requestBrowserFullscreen(shell)");
    const postflight = request.indexOf("const invocationStillCurrent");

    assert.ok(start >= 0 && end > start);
    assert.ok(preflightSession >= 0);
    assert.ok(preflightActivity >= 0);
    assert.ok(nativeRequest > preflightSession);
    assert.ok(nativeRequest > preflightActivity);
    assert.ok(postflight > nativeRequest);

    assert.match(request, /this\.fullscreenSuppressedPresentation = presentation/);
    assert.match(request, /this\.clearFullscreenSuppressionWhenSettled\(promise, shell, presentation\)/);
});

test("pending fullscreen entry is bounded while actual shell exit remains authoritative", () => {
    const exitStart = viewport.indexOf("private async exitFullscreenForPresentation");
    const exitEnd = viewport.indexOf("\n    private async waitForPendingFullscreenRequests", exitStart);
    const exit = viewport.slice(exitStart, exitEnd);

    const actualExit = exit.indexOf("this.requestExitForSpecificShell(targetShell)");
    const pendingWait = exit.indexOf("this.waitForPendingFullscreenRequests(targetShell, targetPresentation)");

    assert.ok(exitStart >= 0 && exitEnd > exitStart);
    assert.ok(actualExit >= 0);
    assert.ok(pendingWait > actualExit);
    assert.match(exit, /this\.fullscreenRequestSerial\+\+/);
    assert.match(exit, /this\.fullscreenEntryAuthorized = false/);
    assert.match(exit, /this\.fullscreenSuppressedPresentation = targetPresentation/);

    const pendingStart = viewport.indexOf("private async waitForPendingFullscreenRequests");
    const pendingEnd = viewport.indexOf("\n    private clearFullscreenSuppressionWhenSettled", pendingStart);
    const pending = viewport.slice(pendingStart, pendingEnd);

    assert.ok(pendingStart >= 0 && pendingEnd > pendingStart);
    assert.match(pending, /Promise\.race/);
    assert.match(pending, /FULLSCREEN_REQUEST_SETTLE_TIMEOUT_MS/);
});

test("abandoned fullscreen suppression clears only after native settlement", () => {
    const start = viewport.indexOf("private clearFullscreenSuppressionWhenSettled");
    const end = viewport.indexOf("\n    private discardPendingFullscreenRequests", start);
    const helper = viewport.slice(start, end);

    assert.ok(start >= 0 && end > start);
    assert.match(helper, /promise\.then\(settled, settled\)/);
    assert.match(helper, /this\.fullscreenSuppressedPresentation === presentation/);
    assert.match(helper, /this\.presentationGeneration === presentation/);
    assert.match(helper, /this\.shell === shell/);
    assert.match(helper, /this\.fullscreenSuppressedPresentation = null/);
});

test("unauthorized or retired fullscreen shells are forced back out", () => {
    const retiredStart = viewport.indexOf("private hideRootUntilRetiredShellExits");
    const retiredEnd = viewport.indexOf("\n    private applyDisplayMode", retiredStart);
    const retired = viewport.slice(retiredStart, retiredEnd);

    assert.ok(retiredStart >= 0 && retiredEnd > retiredStart);
    assert.match(retired, /this\.root\.style\.visibility = "hidden"/);
    assert.match(retired, /requestExitForSpecificShell\(shell\)/);
    assert.match(retired, /this\.root\.style\.visibility = ""/);

    const handlerStart = viewport.indexOf("private readonly handleFullscreenChange");
    const handler = viewport.slice(handlerStart);

    assert.ok(handlerStart >= 0);
    assert.match(handler, /!this\.fullscreenEntryAuthorized/);
    assert.match(handler, /!this\.callbacks\.isGameplayActive\(\)/);
    assert.match(handler, /retiredFullscreenShells\.has\(fullscreenElement as HTMLElement\)/);
});

test("unsafe cleanup still performs viewport teardown before reload-required state", () => {
    const start = webApp.indexOf("function destroyGame(): boolean {");
    const end = webApp.indexOf("\nfunction startPwaMenu(): void {", start);
    const destroy = webApp.slice(start, end);

    assert.ok(start >= 0 && end > start);
    assert.match(destroy, /viewport\.clear\(\)/);
    assert.match(destroy, /if \(!sessionCleanup\.safe\)/);
    assert.match(destroy, /showCleanupFailure\(\)/);

    const viewportClear = destroy.indexOf("viewport.clear()");
    const cleanupFailure = destroy.indexOf("showCleanupFailure()");

    assert.ok(viewportClear >= 0);
    assert.ok(cleanupFailure > viewportClear);
});

test("fullscreen CSS fills wrapper and protects touch safe-area chrome", () => {
    assert.match(styles, /\.game-shell:fullscreen/);
    assert.match(styles, /\.game-shell:-webkit-full-screen/);
    assert.match(styles, /width:\s*100vw/);
    assert.match(styles, /height:\s*100vh/);
    assert.match(styles, /safe-area-inset-left/);
    assert.match(styles, /safe-area-inset-top/);
    assert.match(styles, /\.menu-screen\s*\{[^}]*touch-action:\s*manipulation;/s);
});
