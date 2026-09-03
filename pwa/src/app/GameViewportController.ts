import type { AppGameContainer } from "slick2d-ts";

export type ViewportDisplayMode = { width: number; height: number };

export type BrowserFullscreenController = {
    isFullscreen(): boolean;
    enterFullscreen(): void;
    exitFullscreen(): void;
};

const GAME_WIDTH = 640;
const GAME_HEIGHT = 480;
const GAME_VIEWPORT_WIDTH = 512;
const GAME_VIEWPORT_HEIGHT = 416;
const GAME_CURSOR_HIDE_DELAY_MS = 3000;

export class GameViewportController {
    private shell: HTMLElement | null = null;
    private host: HTMLElement | null = null;
    private container: AppGameContainer | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private resizeAnimationFrame = 0;
    private cursorHideTimer = 0;
    private pointerOverHost = false;
    private cursorSuspended = false;
    private isCurrentSession: () => boolean = () => false;
    private onFatalError: (message: string) => void = () => undefined;

    public readonly getResponsiveWindowedDisplayMode = (): ViewportDisplayMode => {
        const fallback = this.getResponsiveFullscreenDisplayMode();
        const host = this.host;
        if (host === null) {
            return fallback;
        }
        const rect = host.getBoundingClientRect();
        const width = host.clientWidth || rect.width || fallback.width;
        const height = host.clientHeight || rect.height || fallback.height;
        return this.getAspectFitDisplayMode(width, height);
    };

    public setHost(shell: HTMLElement, host: HTMLElement): void {
        this.shell = shell;
        this.host = host;
    }

    public start(container: AppGameContainer, isCurrentSession: () => boolean, onFatalError: (message: string) => void): void {
        this.stopRuntimeListeners();
        this.container = container;
        this.isCurrentSession = isCurrentSession;
        this.onFatalError = onFatalError;
        const host = this.host;
        if (host === null) {
            return;
        }
        if ("ResizeObserver" in window) {
            this.resizeObserver = new ResizeObserver(this.scheduleResize);
            this.resizeObserver.observe(host);
        }
        window.addEventListener("resize", this.scheduleResize);
        document.addEventListener("fullscreenchange", this.scheduleResize);
        this.resumeCursor();
        this.scheduleResize();
    }

    public stop(): void {
        this.stopRuntimeListeners();
        this.stopCursor();
        this.container = null;
        this.shell = null;
        this.host = null;
        this.isCurrentSession = () => false;
        this.onFatalError = () => undefined;
    }

    public suspendCursor(): void {
        this.cursorSuspended = true;
        this.showCursor();
        this.clearCursorTimer();
    }

    public resumeCursor(): void {
        this.cursorSuspended = false;
        const host = this.host;
        if (host === null) {
            return;
        }
        this.stopCursor();
        this.cursorSuspended = false;
        this.pointerOverHost = this.isElementHovered(host);
        host.addEventListener("pointerenter", this.handlePointerEnter);
        host.addEventListener("pointerleave", this.handlePointerLeave);
        host.addEventListener("pointermove", this.handlePointerInput);
        host.addEventListener("pointerdown", this.handlePointerInput);
        host.addEventListener("pointerup", this.handlePointerInput);
        host.addEventListener("wheel", this.handlePointerInput, { passive: true });
        this.showCursor();
        this.scheduleCursorHide();
    }

    public focusCanvas(): void {
        const canvas = this.host?.querySelector("canvas");
        if (!(canvas instanceof HTMLCanvasElement)) {
            return;
        }
        try {
            canvas.focus({ preventScroll: true });
        } catch {
            canvas.focus();
        }
    }

    public scheduleResize = (): void => {
        if (this.resizeAnimationFrame !== 0 || !this.isCurrentSession()) {
            return;
        }
        this.resizeAnimationFrame = requestAnimationFrame(() => {
            this.resizeAnimationFrame = 0;
            if (this.isCurrentSession()) {
                this.applyResponsiveDisplayMode();
            }
        });
    };

    public isShellFullscreen(): boolean {
        return this.shell !== null && document.fullscreenElement === this.shell;
    }

    public createFullscreenController(): BrowserFullscreenController {
        return {
            isFullscreen: () => this.isShellFullscreen(),
            enterFullscreen: () => this.enterFullscreen(),
            exitFullscreen: () => this.exitFullscreen()
        };
    }

    public enterFullscreen(): void {
        const shell = this.shell;
        if (shell === null || this.isShellFullscreen() || !shell.requestFullscreen || !this.isCurrentSession()) {
            return;
        }
        void shell
            .requestFullscreen()
            .then(() => {
                if (this.isCurrentSession()) {
                    this.scheduleResize();
                }
            })
            .catch((error) => console.error(error));
    }

    public exitFullscreen(): void {
        if (!this.isShellFullscreen() || !document.exitFullscreen) {
            return;
        }
        void document
            .exitFullscreen()
            .then(() => {
                if (this.isCurrentSession()) {
                    this.scheduleResize();
                }
            })
            .catch((error) => console.error(error));
    }

    private stopRuntimeListeners(): void {
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        window.removeEventListener("resize", this.scheduleResize);
        document.removeEventListener("fullscreenchange", this.scheduleResize);
        if (this.resizeAnimationFrame !== 0) {
            cancelAnimationFrame(this.resizeAnimationFrame);
            this.resizeAnimationFrame = 0;
        }
    }

    private applyResponsiveDisplayMode(): void {
        const container = this.container;
        if (container === null || this.host === null) {
            return;
        }
        const fullscreenElement = document.fullscreenElement;
        const shellFullscreen = fullscreenElement === this.shell;
        const containerFullscreen = container.isFullscreen();
        if (!shellFullscreen && !containerFullscreen && fullscreenElement !== null) {
            return;
        }
        const displayMode = containerFullscreen ? this.getResponsiveFullscreenDisplayMode() : this.getResponsiveWindowedDisplayMode();
        try {
            void Promise.resolve(container.setDisplayMode(displayMode.width, displayMode.height, containerFullscreen)).catch((error) => {
                if (!this.isCurrentSession()) {
                    return;
                }
                console.error(error);
                this.onFatalError("Unable to resize the game. Reload the page and try again.");
            });
        } catch (error) {
            if (!this.isCurrentSession()) {
                return;
            }
            console.error(error);
            this.onFatalError("Unable to resize the game. Reload the page and try again.");
        }
    }

    private getResponsiveFullscreenDisplayMode(): ViewportDisplayMode {
        const viewport = window.visualViewport;
        const width = viewport?.width || window.innerWidth || document.documentElement.clientWidth || GAME_WIDTH;
        const height = viewport?.height || window.innerHeight || document.documentElement.clientHeight || GAME_HEIGHT;
        return normalizeDisplayMode(width, height);
    }

    private getAspectFitDisplayMode(width: number, height: number): ViewportDisplayMode {
        const displayMode = normalizeDisplayMode(width, height);
        const gameAspectRatio = GAME_VIEWPORT_WIDTH / GAME_VIEWPORT_HEIGHT;
        const displayAspectRatio = displayMode.width / displayMode.height;
        if (displayAspectRatio > gameAspectRatio) {
            return normalizeDisplayMode(displayMode.height * gameAspectRatio, displayMode.height);
        }
        return normalizeDisplayMode(displayMode.width, displayMode.width / gameAspectRatio);
    }

    private readonly handlePointerEnter = (): void => {
        this.pointerOverHost = true;
        this.handlePointerInput();
    };

    private readonly handlePointerLeave = (): void => {
        this.pointerOverHost = false;
        this.showCursor();
        this.clearCursorTimer();
    };

    private readonly handlePointerInput = (): void => {
        this.showCursor();
        this.scheduleCursorHide();
    };

    private scheduleCursorHide(): void {
        this.clearCursorTimer();
        if (this.host === null || !this.pointerOverHost || this.cursorSuspended) {
            return;
        }
        this.cursorHideTimer = window.setTimeout(() => {
            this.cursorHideTimer = 0;
            if (this.host !== null && this.pointerOverHost && !this.cursorSuspended) {
                this.host.classList.add("cursor-hidden");
            }
        }, GAME_CURSOR_HIDE_DELAY_MS);
    }

    private stopCursor(): void {
        const host = this.host;
        if (host !== null) {
            host.removeEventListener("pointerenter", this.handlePointerEnter);
            host.removeEventListener("pointerleave", this.handlePointerLeave);
            host.removeEventListener("pointermove", this.handlePointerInput);
            host.removeEventListener("pointerdown", this.handlePointerInput);
            host.removeEventListener("pointerup", this.handlePointerInput);
            host.removeEventListener("wheel", this.handlePointerInput);
            host.classList.remove("cursor-hidden");
        }
        this.clearCursorTimer();
        this.pointerOverHost = false;
    }

    private showCursor(): void {
        this.host?.classList.remove("cursor-hidden");
    }

    private clearCursorTimer(): void {
        if (this.cursorHideTimer !== 0) {
            clearTimeout(this.cursorHideTimer);
            this.cursorHideTimer = 0;
        }
    }

    private isElementHovered(element: HTMLElement): boolean {
        try {
            return element.matches(":hover");
        } catch {
            return false;
        }
    }
}

function normalizeDisplayMode(width: number, height: number): ViewportDisplayMode {
    return {
        width: Math.max(1, Math.trunc(width)),
        height: Math.max(1, Math.trunc(height))
    };
}
