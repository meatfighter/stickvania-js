import { focusOwnedPanel } from "./app/FocusOwnership.js";
import { initializeWithDeadline, ReloadRequiredError } from "./app/PreparationDeadline.js";
import { removePreference } from "./app/BrowserPersistence.js";
import { ButtonMapping } from "./stickvania/ButtonMapping.js";
import { PersistenceSession, RestoreAttempt } from "./app/PersistenceSession.js";
import { SessionCleanup } from "./app/SessionCleanup.js";
import {
    beginGameAudio,
    commitGameAudio,
    isGameAudioCurrent,
    isGameAudioLatest,
    releaseGameAudio,
    setGameAudioInterruptionHandler,
    type GameAudioAttempt
} from "./app/PlaybackSession.js";
import { GameSessionOwnership } from "./app/GameSessionOwnership.js";
import { SoundStore, type AppGameContainer } from "slick2d-ts";
import { BrowserPreferences } from "./app/BrowserPreferences.js";
import { GameViewportController } from "./app/GameViewportController.js";
import { renderMenu } from "./app/MenuView.js";
import { StickvaniaRuntimeLoader, type PreparedRuntime } from "./app/RuntimeLoader.js";
import { ScreenWakeLockManager } from "./app/ScreenWakeLockManager.js";
import { registerStickvaniaServiceWorker } from "./app/ServiceWorkerRegistrar.js";
import { SessionGeneration } from "./app/SessionGeneration.js";
import { createDisplayMonochromePalette, type DisplayModePreference } from "./DisplayThemes.js";
import { RumbleManager } from "./rumble/RumbleManager.js";
import type { Main } from "./stickvania/Main.js";
import { hasPotentialBrowserStoredStickvaniaGameState } from "./stickvania/persistence/GameStatePreflight.js";
import { GAME_STATE_STORAGE_KEY } from "./stickvania/persistence/GameStateSchema.js";
import type { StickvaniaBufferedGame, StickvaniaScalingPreference } from "./stickvania/StickvaniaBufferedGame.js";
import type { StickvaniaGameStateStore } from "./stickvania/persistence/StickvaniaGameStateStore.js";
import "./styles.css";

const bootstrap = Reflect.get(window, "__stickvaniaBootstrap") as { claim(): boolean } | undefined;
if (bootstrap === undefined || bootstrap.claim()) {
    try {
        startApplication();
    } catch (error) {
        console.error("Application startup failed.", error);
        const root = document.getElementById("app");
        if (root !== null) {
            root.innerHTML =
                '<main role="alert" class="boot-screen boot-failed"><section class="load-error-panel"><p>Unable to start. Reload this tab.</p><a href="">Reload</a></section></main>';
            if (document.hasFocus()) root.querySelector<HTMLAnchorElement>("a")?.focus();
        }
    }
}

function startApplication(): void {
    const HIGH_DPI_ENABLED = true;
    const MAX_DEVICE_PIXEL_RATIO = 4;
    type PwaSessionState = "booting" | "menu" | "starting" | "running" | "stopping" | "error";

    let app: HTMLElement;
    let ownership: GameSessionOwnership;
    let viewport: GameViewportController;
    let container: AppGameContainer | null = null;
    let game: Main | null = null;
    let activeBufferedGame: StickvaniaBufferedGame | null = null;
    let menuOverlay: HTMLElement | null = null;
    let liveMenuOpen = false;
    let gameLaunchInProgress = false;
    let pwaSessionState: PwaSessionState = "booting";
    let gameOwnershipEpoch = -1;
    let activeGameSession = 0;
    let menuRequestSerial = 0;
    let rumbleManager: RumbleManager | null = null;
    let gameStateStore: StickvaniaGameStateStore | null = null;

    const preferences = new BrowserPreferences(false);
    const persistence = new PersistenceSession<Main>();
    let activeMenu: HTMLElement | null = null;
    let sessionMapping = new ButtonMapping();
    const sessions = new SessionGeneration();
    const runtimeLoader = new StickvaniaRuntimeLoader(refreshVisibleBootProgress);
    const screenWakeLock = new ScreenWakeLockManager();
    const sessionCleanup = new SessionCleanup();

    function canActivateFromMenu(): boolean {
        return (
            sessionCleanup.safe &&
            pwaSessionState === "menu" &&
            ownership.isCurrent(ownership.epoch) &&
            document.visibilityState === "visible" &&
            document.hasFocus()
        );
    }

    function isCurrentGameSession(session: number): boolean {
        return sessionCleanup.safe && sessions.isCurrent(session) && ownership.isCurrent(gameOwnershipEpoch);
    }

    function isStartingGameSession(session: number, audio: GameAudioAttempt): boolean {
        return (
            isCurrentGameSession(session) &&
            pwaSessionState === "starting" &&
            isGameAudioCurrent(audio) &&
            document.visibilityState === "visible" &&
            document.hasFocus() &&
            container?.isGraphicsContextLost() !== true
        );
    }

    function currentPreferenceWriteAuthorized(): boolean {
        return ownership?.isCurrent(ownership.epoch) === true;
    }

    function setAudioVolume(value: number, persist = true): boolean {
        const saved = preferences.setVolume(value, persist, currentPreferenceWriteAuthorized);
        applyAudioVolume(preferences.volume);
        return saved;
    }

    function applyApplicationAudioPreferences(): void {
        const store = SoundStore.get();
        store.setMusicOn(true);
        store.setSoundsOn(true);
        applyAudioVolume(preferences.volume);
    }

    function applyAudioVolume(value: number): void {
        const clampedValue = BrowserPreferences.clampVolume(value);
        SoundStore.get().setSoundVolume(Math.sqrt(clampedValue));
        SoundStore.get().setMusicVolume(clampedValue);
        container?.setSoundVolume(Math.sqrt(clampedValue));
        container?.setMusicVolume(clampedValue);
    }

    function setDisplayModePreference(value: DisplayModePreference): boolean {
        const saved = preferences.setDisplayMode(value, currentPreferenceWriteAuthorized);
        if (game !== null) {
            applyDisplayModePreference(game);
        }
        return saved;
    }

    function applyDisplayModePreference(target: Main): void {
        target.darkDisplayMode = preferences.displayMode === "dark";
        target.displayMonochromePalette = createDisplayMonochromePalette(preferences.displayMode);
    }

    function setScalingPreference(value: StickvaniaScalingPreference): boolean {
        const saved = preferences.setScaling(value, currentPreferenceWriteAuthorized);
        activeBufferedGame?.setScalingPreference(value);
        return saved;
    }

    function setFullscreenPreference(value: boolean): boolean {
        return preferences.setFullscreen(value, currentPreferenceWriteAuthorized);
    }

    function getRumbleManager(): RumbleManager {
        if (rumbleManager === null) {
            rumbleManager = new RumbleManager(preferences.rumbleEnabled);
            rumbleManager.setSuspended(pwaSessionState !== "running");
        }
        return rumbleManager;
    }

    function setRumbleEnabled(value: boolean): boolean {
        const saved = preferences.setRumbleEnabled(value, currentPreferenceWriteAuthorized);
        const manager = getRumbleManager();
        manager.setEnabled(value);
        if (game !== null) {
            game.rumble = manager;
            if (pwaSessionState === "running") {
                game.resumeBrowserOnlyRumbles();
            }
        }
        return saved;
    }

    function showBoot(progress = 0): void {
        const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
        const existingProgress = app.querySelector<HTMLElement>("[data-boot-progress='true']");
        if (existingProgress !== null) {
            existingProgress.setAttribute("aria-valuenow", String(percent));
            existingProgress.querySelector<HTMLElement>(".progress-bar")?.style.setProperty("--progress", `${percent}%`);
            return;
        }
        app.innerHTML = `<main class="boot-screen" role="status" aria-label="Loading"><section class="load-progress-panel" aria-live="polite"><div class="progress-shell" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}" data-boot-progress="true"><div class="progress-bar" style="--progress: ${percent}%"></div></div></section></main>`;
    }

    function showLoadError(title: string, message: string, retryHandler: () => void, action: "Retry" | "Reload" = "Retry"): void {
        if (!ownership?.owned) {
            return;
        }
        app.innerHTML = `<main class="boot-screen boot-failed" role="alert"><section class="load-error-panel" aria-label="${escapeHtml(title)}"><div class="failure-icon" aria-hidden="true">&#x1F480;</div><div class="boot-title">${escapeHtml(title)}</div><p class="boot-error">${escapeHtml(message)}</p><button id="retry-button" class="retry-button" type="button">${action}</button></section></main>`;
        const button = app.querySelector<HTMLButtonElement>("#retry-button");
        const epoch = ownership.epoch;
        button?.addEventListener("click", () => {
            if (button.isConnected && ownership.isCurrent(epoch)) retryHandler();
        });
        if (button !== null) focusOwnedPanel(button, () => ownership.isCurrent(epoch));
    }

    function showError(message: string): void {
        if (!destroyGame()) {
            return;
        }
        pwaSessionState = "menu";
        showLoadError("Unable to continue.", message, () => window.location.reload(), "Reload");
    }

    function showMenu(errorText = ""): void {
        if (!ownership?.isCurrent(ownership.epoch)) {
            return;
        }
        if (!destroyGame()) {
            return;
        }
        pwaSessionState = "menu";
        renderRootMenu(errorText);
    }

    function renderRootMenu(errorText = ""): HTMLElement {
        return renderMenuForParent(app, hasPotentialSavedGameState(), errorText, false);
    }

    function renderMenuForParent(parent: HTMLElement, canContinue: boolean, errorText: string, overlay: boolean): HTMLElement {
        const menu = renderMenu(
            parent,
            {
                canContinue,
                errorText,
                overlay,
                volume: preferences.volume,
                displayMode: preferences.displayMode,
                scaling: preferences.scaling,
                rumbleEnabled: preferences.rumbleEnabled,
                fullscreen: preferences.fullscreen,
                fullscreenUnavailable: viewport.getFullscreenCapability() === "unavailable"
            },
            {
                onDisplayModeChange: setDisplayModePreference,
                onScalingChange: setScalingPreference,
                onRumbleChange: setRumbleEnabled,
                onFullscreenChange: setFullscreenPreference,
                onVolumeInput: (value) => void setAudioVolume(value, false),
                onVolumeCommit: (value) => setAudioVolume(value, true),
                onNewGame: () => {
                    if (!canActivateFromMenu()) {
                        return;
                    }
                    clearStoredGameState();
                    void startGame(false);
                },
                onContinue: () => {
                    if (!canActivateFromMenu()) {
                        return;
                    }
                    if (hasLiveSuspendedGame()) {
                        void resumeLiveGameFromMenu();
                    } else {
                        void startGame(true);
                    }
                },
                onReset: resetPwaState
            }
        );
        guardMenuEvents(menu);
        viewport.focusMenuPanel(menu);
        return menu;
    }

    function resetPwaState(): void {
        if (!canActivateFromMenu()) return;
        const epoch = ownership.epoch;
        persistence.abandonStored();
        if (!destroyGame()) return;
        const cleared = preferences.reset(() => ownership.isCurrent(epoch));
        if (!ownership.isCurrent(epoch)) return;
        sessionMapping.resetToDefaults();
        applyApplicationAudioPreferences();
        const manager = getRumbleManager();
        manager.setEnabled(preferences.rumbleEnabled);
        manager.setSuspended(true);
        pwaSessionState = "menu";
        renderRootMenu(cleared ? "" : "Some settings could not be reset.");
    }

    async function startGame(restoreSavedGame: boolean): Promise<void> {
        if (!canActivateFromMenu()) return;
        const runtime = runtimeLoader.getPreparedRuntime();
        if (runtime === null) {
            startPwaMenu();
            return;
        }
        if (!destroyGame()) return;
        gameOwnershipEpoch = ownership.epoch;
        const session = sessions.begin();
        activeGameSession = session;
        pwaSessionState = "starting";
        gameLaunchInProgress = true;
        const restoreAttempt = new RestoreAttempt();
        let audio: GameAudioAttempt | null = null;
        try {
            applyApplicationAudioPreferences();
            syncScreenWakeLock();
            if (!isCurrentGameSession(session)) return;
            const host = viewport.createShell(session);
            runtime.slick.Display.setParent(host);
            audio = beginGameAudio();
            requestPreferredFullscreen();
            if (!(await audio.ready) || !isStartingGameSession(session, audio)) return;
            if (restoreSavedGame && !hasPotentialSavedGameState()) {
                showMenu();
                return;
            }
            await launchPreparedGame(runtime, restoreSavedGame, session, audio, restoreAttempt);
        } catch (error) {
            if (!isCurrentGameSession(session)) return;
            if (restoreAttempt.rejected) {
                persistence.rejectStored();
                showMenu();
            } else {
                console.error(error);
                if (!destroyGame()) return;
                pwaSessionState = "menu";
                showLoadError(
                    "Unable to start.",
                    error instanceof ReloadRequiredError ? error.message : "The game could not be started. Try again.",
                    error instanceof ReloadRequiredError ? () => window.location.reload() : startPwaMenu,
                    error instanceof ReloadRequiredError ? "Reload" : "Retry"
                );
            }
        } finally {
            if (isCurrentGameSession(session) && pwaSessionState === "starting" && (audio === null || isGameAudioLatest(audio)))
                requestPwaMenu("start-not-accepted");
        }
    }

    async function launchPreparedGame(
        runtime: PreparedRuntime,
        restoreSavedGame: boolean,
        session: number,
        audio: GameAudioAttempt,
        restoreAttempt: RestoreAttempt
    ): Promise<void> {
        if (!isStartingGameSession(session, audio)) {
            return;
        }
        const host = viewport.gameHost;
        if (host === null) {
            throw new Error("Stickvania game host is unavailable during startup.");
        }
        let candidateContainer: AppGameContainer | null = null;
        let publishedToShell = false;
        try {
            const mainGame = new runtime.Main();
            mainGame.buttonMapping.copyFrom(sessionMapping);
            mainGame.difficulty = preferences.difficulty;
            applyDisplayModePreference(mainGame);
            mainGame.rumble = getRumbleManager();
            const bufferedGame = new runtime.StickvaniaBufferedGame(mainGame, preferences.scaling);
            const displayMode = viewport.getResponsiveDisplayMode();
            const appContainer = (candidateContainer = new runtime.slick.AppGameContainer(bufferedGame, displayMode.width, displayMode.height, false));
            appContainer.setPreserveAudioCacheOnDestroy(true);
            appContainer.setLoopSuspended(true);
            appContainer.getInput().pause();
            appContainer.setHighDpiEnabled(HIGH_DPI_ENABLED);
            appContainer.setMaxDevicePixelRatio(MAX_DEVICE_PIXEL_RATIO);
            if (!isStartingGameSession(session, audio)) return;
            container = appContainer;
            game = mainGame;
            publishedToShell = true;
            activeBufferedGame = bufferedGame;
            mainGame.setInputMappingChangedHandler(() => {
                if (!isCurrentGameSession(session) || game !== mainGame) return { saved: false, reason: "stale-session" };
                sessionMapping.copyFrom(mainGame.buttonMapping);
                return sessionMapping.save(() => isCurrentGameSession(session) && game === mainGame);
            });
            mainGame.setDifficultyChangedHandler((difficulty) =>
                preferences.setDifficulty(difficulty, () => ownership.owned && isCurrentGameSession(session) && game === mainGame)
            );
            viewport.attach(appContainer, session);
            appContainer.setGraphicsLifecycleHandler((state) => {
                if (state === "lost" && isCurrentGameSession(session)) {
                    requestPwaMenu("graphics-context-lost");
                }
            });
            if (restoreSavedGame) {
                mainGame.loadingCompleteHandler = (gc) => {
                    if (!isStartingGameSession(session, audio)) return false;
                    if (!getGameStateStore(runtime).restore(mainGame, gc)) restoreAttempt.reject();
                    applyDisplayModePreference(mainGame);
                    return true;
                };
            }
            appContainer.setAlwaysRender(true);
            appContainer.setVSync(true);
            appContainer.setSmoothDeltas(false);
            appContainer.setShowFPS(false);
            appContainer.setClearEachFrame(true);
            await initializeWithDeadline(Promise.resolve(appContainer.setDisplayMode(displayMode.width, displayMode.height, false)), sessionCleanup);
            if (!isStartingGameSession(session, audio)) {
                retireStaleContainer(appContainer);
                return;
            }
            await initializeWithDeadline(appContainer.start(), sessionCleanup);
            if (!isStartingGameSession(session, audio)) {
                retireStaleContainer(appContainer);
                return;
            }
            appContainer.setErrorHandler((error: unknown) => {
                if (!isCurrentGameSession(session)) {
                    return;
                }
                console.error(error);
                if (!destroyGame()) {
                    return;
                }
                pwaSessionState = "menu";
                showLoadError("Unable to continue.", "Reload the page and try again.", () => window.location.reload(), "Reload");
            });
            applyAudioVolume(preferences.volume);
            if (!(await commitGameAudio(audio)) || !isStartingGameSession(session, audio)) {
                return;
            }
            viewport.startResponsiveSizing(host);
            viewport.startCursorAutoHide(host);
            getRumbleManager().setEnabled(preferences.rumbleEnabled);
            viewport.focusCanvas();
            if (!isStartingGameSession(session, audio) || game !== mainGame || container !== appContainer) {
                return;
            }
            appContainer.getInput().resume();
            gameLaunchInProgress = false;
            pwaSessionState = "running";
            mainGame.setBrowserSuspended(false);
            getRumbleManager().setSuspended(false);
            mainGame.resumeBrowserOnlyRumbles();
            if (
                !isCurrentGameSession(session) ||
                !isGameAudioCurrent(audio) ||
                pwaSessionState !== "running" ||
                game !== mainGame ||
                container !== appContainer
            ) {
                return;
            }
            persistence.accept(mainGame);
            appContainer.setLoopSuspended(false);
            viewport.startHamburgerVisibilityMonitor();
            syncScreenWakeLock();
        } finally {
            if (!publishedToShell) {
                sessionCleanup.run(() => candidateContainer?.destroy());
                if (!sessionCleanup.safe) showCleanupFailure();
            } else if (!sessionCleanup.safe) {
                if (container === candidateContainer) {
                    destroyGame();
                } else {
                    sessionCleanup.run(() => candidateContainer?.destroy());
                    showCleanupFailure();
                }
            }
        }
    }

    function retireStaleContainer(appContainer: AppGameContainer): void {
        sessionCleanup.run(() => appContainer.destroy());
        if (!sessionCleanup.safe) {
            showCleanupFailure();
        }
    }

    function requestPreferredFullscreen(): void {
        if (!preferences.fullscreen || viewport.getFullscreenCapability() === "unavailable") {
            return;
        }
        void viewport.requestFullscreen();
    }

    function refreshVisibleBootProgress(): void {
        if (typeof app !== "undefined" && ownership?.owned && pwaSessionState === "booting" && app.querySelector("[data-boot-progress='true']") !== null) {
            showBoot(runtimeLoader.getProgress());
        }
    }

    function getGameStateStore(runtime: PreparedRuntime): StickvaniaGameStateStore {
        if (gameStateStore === null) {
            gameStateStore = new runtime.StickvaniaGameStateStore(__APP_VERSION__);
        }
        return gameStateStore;
    }

    function getLoadedGameStateStore(): StickvaniaGameStateStore | null {
        if (gameStateStore !== null) {
            return gameStateStore;
        }
        const runtime = runtimeLoader.getPreparedRuntime();
        return runtime === null ? null : getGameStateStore(runtime);
    }

    function hasPotentialSavedGameState(): boolean {
        return persistence.canReadStored() && hasPotentialBrowserStoredStickvaniaGameState();
    }

    function returnToMenu(): void {
        requestPwaMenu("hamburger");
    }

    function suspendGameForMenu(): boolean {
        return sessionCleanup.run(
            () => container?.setLoopSuspended(true),
            () => game?.setBrowserSuspended(true),
            () => container?.getInput().pause(),
            () => rumbleManager?.setSuspended(true),
            () => releaseGameAudio()
        );
    }

    function requestPwaMenu(_reason: string): void {
        if (pwaSessionState === "booting" || pwaSessionState === "menu" || pwaSessionState === "stopping" || pwaSessionState === "error") {
            return;
        }
        if (pwaSessionState === "running" && canOpenLiveMenuOverlay()) {
            void showLiveMenuOverlay();
            return;
        }
        const retainExistingOverlay = liveMenuOpen && menuOverlay !== null && game !== null && container !== null;
        const session = activeGameSession;
        pwaSessionState = "stopping";
        sessionCleanup.run(() => syncScreenWakeLock());
        const suspended = suspendGameForMenu();
        if (suspended && !retainExistingOverlay) sessionCleanup.trySave(saveCurrentGameState);
        if (!sessionCleanup.safe) {
            destroyGame();
            return;
        }
        if (retainExistingOverlay) {
            void restoreExistingLiveMenuAfterInterruptedResume(session);
        } else {
            showMenu();
        }
    }

    function canOpenLiveMenuOverlay(): boolean {
        return (
            pwaSessionState === "running" &&
            game !== null &&
            container !== null &&
            !container.isDestroyed() &&
            viewport.gameShell !== null &&
            viewport.gameHost !== null
        );
    }

    function hasLiveSuspendedGame(): boolean {
        return pwaSessionState === "menu" && liveMenuOpen && menuOverlay !== null && game !== null && container !== null && viewport.gameHost !== null;
    }

    async function showLiveMenuOverlay(): Promise<void> {
        if (pwaSessionState !== "running" || game === null || container === null || viewport.gameShell === null) {
            return;
        }
        const session = activeGameSession;
        pwaSessionState = "stopping";
        liveMenuOpen = true;
        sessionCleanup.run(() => syncScreenWakeLock());
        if (suspendGameForMenu()) sessionCleanup.trySave(saveCurrentGameState);
        sessionCleanup.run(
            () => viewport.stopHamburgerVisibilityMonitor(),
            () => viewport.hideHamburger(),
            () => viewport.stopCursorAutoHide()
        );
        if (!sessionCleanup.safe) {
            destroyGame();
            return;
        }
        if (!(await viewport.exitFullscreenForMenu())) {
            return;
        }
        if (!isCurrentGameSession(session) || pwaSessionState !== "stopping" || game === null || container === null) {
            return;
        }
        if (
            !sessionCleanup.run(() => {
                menuOverlay = renderMenuForParent(app, true, "", true);
            })
        ) {
            destroyGame();
            return;
        }
        pwaSessionState = "menu";
        if (menuOverlay !== null) viewport.focusMenuPanel(menuOverlay);
        syncScreenWakeLock();
    }

    async function resumeLiveGameFromMenu(): Promise<void> {
        if (
            !canActivateFromMenu() ||
            !hasLiveSuspendedGame() ||
            game === null ||
            container === null ||
            menuOverlay === null ||
            container.isGraphicsContextLost()
        ) {
            return;
        }
        const liveGame = game;
        const liveContainer = container;
        const liveOverlay = menuOverlay;
        const liveHost = viewport.gameHost;
        const session = activeGameSession;
        pwaSessionState = "starting";
        let audio: GameAudioAttempt | null = null;
        const ownsRetainedRuntime = (): boolean => isCurrentGameSession(session) && game === liveGame && container === liveContainer;
        try {
            applyApplicationAudioPreferences();
            if (!ownsRetainedRuntime() || pwaSessionState !== "starting") return;
            audio = beginGameAudio();
            requestPreferredFullscreen();
            if (
                !(await audio.ready) ||
                !isStartingGameSession(session, audio) ||
                game !== liveGame ||
                container !== liveContainer ||
                menuOverlay !== liveOverlay
            ) {
                return;
            }
            applyDisplayModePreference(liveGame);
            applyAudioVolume(preferences.volume);
            if (
                !(await commitGameAudio(audio)) ||
                !isStartingGameSession(session, audio) ||
                game !== liveGame ||
                container !== liveContainer ||
                menuOverlay !== liveOverlay
            ) {
                return;
            }
            viewport.reconcileDisplayModeNow();
            viewport.scheduleResize();
            viewport.focusCanvas();
            if (!isStartingGameSession(session, audio)) {
                return;
            }
            liveContainer.getInput().resume();
            liveGame.clearInputPressedRecords();
            if (!isStartingGameSession(session, audio)) {
                return;
            }
            pwaSessionState = "running";
            removeMenuOverlay();
            if (
                !isCurrentGameSession(session) ||
                !isGameAudioCurrent(audio) ||
                pwaSessionState !== "running" ||
                game !== liveGame ||
                container !== liveContainer
            ) {
                return;
            }
            if (liveHost !== null) {
                viewport.startCursorAutoHide(liveHost);
            }
            viewport.startHamburgerVisibilityMonitor();
            liveGame.setBrowserSuspended(false);
            getRumbleManager().setSuspended(false);
            liveGame.resumeBrowserOnlyRumbles();
            if (!isCurrentGameSession(session) || !isGameAudioCurrent(audio) || pwaSessionState !== "running") {
                return;
            }
            liveContainer.setLoopSuspended(false);
            syncScreenWakeLock();
        } catch (error) {
            if (ownsRetainedRuntime() && (audio === null || isGameAudioLatest(audio))) {
                console.error("Unable to continue the playback session.", error);
                requestPwaMenu("continue-failed");
            }
        } finally {
            if (
                ownsRetainedRuntime() &&
                (audio === null || isGameAudioLatest(audio)) &&
                pwaSessionState === "starting" &&
                game === liveGame &&
                container === liveContainer &&
                menuOverlay === liveOverlay
            ) {
                requestPwaMenu("continue-not-accepted");
            }
        }
    }

    async function restoreExistingLiveMenuAfterInterruptedResume(session: number): Promise<void> {
        if (!(await viewport.exitFullscreenForMenu())) {
            return;
        }
        if (!isCurrentGameSession(session) || pwaSessionState !== "stopping" || !liveMenuOpen || menuOverlay === null || game === null || container === null) {
            return;
        }
        pwaSessionState = "menu";
        if (menuOverlay !== null) viewport.focusMenuPanel(menuOverlay);
        syncScreenWakeLock();
    }

    function removeMenuOverlay(): void {
        const overlay = menuOverlay;
        menuOverlay = null;
        liveMenuOpen = false;
        overlay?.remove();
    }

    function saveCurrentGameState(): boolean {
        const mainGame = game;
        if (
            !sessionCleanup.safe ||
            !ownership?.owned ||
            mainGame === null ||
            !persistence.canSave(mainGame) ||
            container?.isLoopSuspended() !== true ||
            !mainGame.isStateSaveReady()
        )
            return false;
        const store = getLoadedGameStateStore();
        if (store === null) return false;
        const result = store.save(mainGame, () => ownership.owned && game === mainGame && persistence.canSave(mainGame));
        if (result.saved) persistence.didSave();
        return result.saved;
    }

    function clearStoredGameState(): void {
        if (!currentPreferenceWriteAuthorized()) {
            return;
        }
        persistence.abandonStored();
        const store = getLoadedGameStateStore();
        if (store !== null) {
            store.clear(currentPreferenceWriteAuthorized);
            return;
        }
        removePreference("Stickvania saved game", GAME_STATE_STORAGE_KEY, currentPreferenceWriteAuthorized);
    }

    function syncScreenWakeLock(): void {
        screenWakeLock.setDesired(
            ownership?.isCurrent(gameOwnershipEpoch) === true &&
                (pwaSessionState === "running" || (pwaSessionState === "starting" && !liveMenuOpen && gameLaunchInProgress))
        );
    }

    function destroyGame(): boolean {
        pwaSessionState = "stopping";
        menuRequestSerial++;
        sessions.invalidate();
        activeGameSession = 0;
        gameLaunchInProgress = false;
        const oldGame = game;
        persistence.retire(oldGame);
        activeMenu = null;
        const oldContainer = container;
        sessionCleanup.run(
            () => syncScreenWakeLock(),
            () => oldContainer?.setLoopSuspended(true),
            () => oldGame?.setBrowserSuspended(true),
            () => oldContainer?.getInput().pause(),
            () => releaseGameAudio(),
            () => removeMenuOverlay(),
            () => viewport.stopHamburgerVisibilityMonitor(),
            () => viewport.stopCursorAutoHide(),
            () => viewport.stopResponsiveSizing(),
            () => oldGame?.stopAllSounds(),
            () => rumbleManager?.setSuspended(true),
            () => rumbleManager?.stopAll(),
            () => {
                if (oldContainer !== null) {
                    oldContainer.destroy();
                } else {
                    SoundStore.get().stopAllPlayback();
                }
            },
            () => viewport.clear(),
            () => runtimeLoader.getPreparedRuntime()?.slick.Display.setParent(null)
        );
        container = null;
        game = null;
        menuOverlay = null;
        liveMenuOpen = false;
        activeBufferedGame = null;
        if (!sessionCleanup.safe) {
            showCleanupFailure();
        }
        return sessionCleanup.safe;
    }

    function startPwaMenu(): void {
        const epoch = ownership.epoch;
        if (!sessionCleanup.safe || !ownership.isCurrent(epoch)) {
            return;
        }
        refreshOwnedSettings();
        const request = ++menuRequestSerial;
        pwaSessionState = "booting";
        applyApplicationAudioPreferences();
        showBoot(runtimeLoader.getProgress());
        const serviceWorkerReady = registerStickvaniaServiceWorker().catch((error) => {
            console.warn("Service worker registration failed.", error);
        });
        runtimeLoader.setReadinessBarrier(serviceWorkerReady);
        void runtimeLoader
            .ensurePrepared(runtimeLoader.hasError())
            .then(() => {
                if (request !== menuRequestSerial || !ownership.isCurrent(epoch) || pwaSessionState !== "booting") {
                    return;
                }
                pwaSessionState = "menu";
                renderRootMenu();
            })
            .catch((error) => {
                if (request !== menuRequestSerial || !ownership.isCurrent(epoch) || pwaSessionState !== "booting") {
                    return;
                }
                console.error(error);
                pwaSessionState = "menu";
                showLoadError(
                    "Unable to load.",
                    error instanceof ReloadRequiredError ? error.message : "Check your connection and try again.",
                    error instanceof ReloadRequiredError ? () => window.location.reload() : startPwaMenu,
                    error instanceof ReloadRequiredError ? "Reload" : "Retry"
                );
            });
    }

    function setupPageLifecycleHandlers(): void {
        window.addEventListener("pagehide", () => requestPwaMenu("pagehide"));
        window.addEventListener("blur", () => requestPwaMenu("blur"));
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") {
                requestPwaMenu("hidden");
            }
        });
    }

    const handleBrowserReservedKey = (event: KeyboardEvent): void => {
        if (pwaSessionState !== "starting" && pwaSessionState !== "running") {
            return;
        }
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopImmediatePropagation();
            requestPwaMenu("escape");
        }
    };

    async function boot(): Promise<void> {
        app = requiredElement<HTMLElement>(document, "#app");
        viewport = new GameViewportController(app, {
            isSessionCurrent: isCurrentGameSession,
            isGameplayActive: () => pwaSessionState === "starting" || pwaSessionState === "running",
            isGameplayRunning: () => pwaSessionState === "running",
            returnToMenu,
            fullscreenExited: () => requestPwaMenu("fullscreen-exit"),
            reportResizeError: (error) => {
                console.error(error);
                showError("Unable to resize the game. Reload the page and try again.");
            }
        });
        setupPageLifecycleHandlers();
        document.addEventListener("keydown", handleBrowserReservedKey, true);
        setGameAudioInterruptionHandler(requestPwaMenu);
        ownership = new GameSessionOwnership(app, startPwaMenu, () => releaseOwnedSession());
        ownership.start();
    }

    function requiredElement<T extends Element>(parent: ParentNode, selector: string): T {
        const element = parent.querySelector<T>(selector);
        if (element === null) {
            throw new Error(`Stickvania page is missing ${selector}.`);
        }
        return element;
    }

    function escapeHtml(text: string): string {
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => void boot(), { once: true });
    } else {
        void boot();
    }

    function releaseOwnedSession(): void {
        pwaSessionState = "stopping";
        sessions.invalidate();
        menuRequestSerial++;
        sessionCleanup.run(() => syncScreenWakeLock());
        if (suspendGameForMenu()) sessionCleanup.trySave(saveCurrentGameState);
        destroyGame();
        if (sessionCleanup.safe) {
            pwaSessionState = "menu";
        }
        sessionCleanup.assertSafe();
    }

    function showCleanupFailure(): void {
        pwaSessionState = "error";
        try {
            screenWakeLock.setDesired(false);
        } catch (error) {
            console.error("Unable to release screen wake intent.", error);
        }
        console.error("Session cleanup requires a reload.", sessionCleanup.failure);
        try {
            app.innerHTML =
                '<main class="boot-screen" role="alert"><section class="load-error-panel"><p>This session could not be stopped safely. Reload this tab before continuing.</p><button type="button" id="session-reload">Reload</button></section></main>';
            const button = app.querySelector<HTMLButtonElement>("#session-reload");
            button?.addEventListener("click", () => {
                if (button.isConnected) window.location.reload();
            });
            if (button !== null) focusOwnedPanel(button, () => pwaSessionState === "error");
        } catch (error) {
            console.error("Unable to display the reload message.", error);
        }
    }

    function guardMenuEvents(menu: HTMLElement): void {
        const epoch = ownership.epoch;
        activeMenu = menu;
        const guard = (event: Event): void => {
            if (activeMenu === menu && menu.isConnected && ownership.isCurrent(epoch) && pwaSessionState === "menu") return;
            event.preventDefault();
            event.stopImmediatePropagation();
        };
        for (const name of ["click", "input", "change", "keydown", "pointerdown"]) menu.addEventListener(name, guard, true);
    }

    function refreshOwnedSettings(): void {
        if (!persistence.beginOwnership(ownership.epoch)) return;
        preferences.reload();
        sessionMapping = ButtonMapping.load();
    }
}
