import { Music } from "slick2d-ts";
import { isStopWatchMusicHeld } from "./StopWatchMusicHold.js";

/** Song chooses the next part; the engine owns disposable playback generations. */
export class Song {
    private intro: Music | null = null;
    private loop: Music | null = null;
    private playing = false;
    private stopWatchPendingStart = false;
    private stopWatchPausedPart: Music | null = null;

    public constructor(intro: string);
    public constructor(intro: string | null, loop: string);
    public constructor(intro: string | null, loop?: string) {
        if (loop === undefined) {
            this.intro = new Music(intro as string);
            return;
        }
        if (intro !== null) {
            this.intro = new Music(intro);
        }
        this.loop = new Music(loop);
    }

    public stop(): void {
        if (this.intro !== null && this.intro.getTransportState() !== "stopped") {
            this.intro.stop();
        }
        if (this.loop !== null && this.loop.getTransportState() !== "stopped") {
            this.loop.stop();
        }
        this.stopWatchPendingStart = false;
        this.stopWatchPausedPart = null;
        this.playing = false;
    }

    private startFirstPart(): boolean {
        if (this.intro !== null) {
            this.intro.play();
            return true;
        }
        if (this.loop !== null) {
            this.loop.loop();
            return true;
        }
        return false;
    }

    public play(): void {
        if (this.playing) {
            return;
        }
        this.stop();
        this.playing = true;
        if (isStopWatchMusicHeld(this)) {
            this.stopWatchPendingStart = true;
            return;
        }
        if (!this.startFirstPart()) {
            this.playing = false;
        }
    }

    public update(): void {
        if (isStopWatchMusicHeld(this) || this.stopWatchPendingStart || !this.playing || this.intro?.isTransportActive()) {
            return;
        }
        if (this.loop !== null) {
            if (!this.loop.isTransportActive()) {
                this.loop.loop();
            }
        } else {
            this.playing = false;
        }
    }

    /** Pause/adopt the exact active Song part without changing Song sequencing. */
    public holdForStopWatch(): void {
        if (this.stopWatchPendingStart) {
            const restoredPart = this.getTransportActivePart();
            if (restoredPart === null) {
                return;
            }
            this.stopWatchPendingStart = false;
            this.stopWatchPausedPart = restoredPart;
            if (restoredPart.getTransportState() === "playing") {
                restoredPart.pause();
            }
            return;
        }

        const part = this.getTransportActivePart();
        if (part === null) {
            return;
        }
        if (part.getTransportState() === "playing") {
            part.pause();
        }
        if (part.getTransportState() === "paused") {
            this.stopWatchPausedPart = part;
        }
    }

    public releaseStopWatchHold(): void {
        if (this.stopWatchPendingStart) {
            const restoredPart = this.getTransportActivePart();
            this.stopWatchPendingStart = false;
            if (restoredPart !== null) {
                this.stopWatchPausedPart = null;
                if (restoredPart.getTransportState() === "paused") {
                    restoredPart.resume();
                }
                return;
            }
            this.stopWatchPausedPart = null;
            if (!this.startFirstPart()) {
                this.playing = false;
            }
            return;
        }

        const part = this.stopWatchPausedPart;
        this.stopWatchPausedPart = null;
        if (part !== null && part.getTransportState() === "paused") {
            part.resume();
        }
    }

    public cancelStopWatchHold(): void {
        this.stopWatchPendingStart = false;
        this.stopWatchPausedPart = null;
    }

    private getTransportActivePart(): Music | null {
        if (this.intro !== null && this.intro.isTransportActive()) {
            return this.intro;
        }
        if (this.loop !== null && this.loop.isTransportActive()) {
            return this.loop;
        }
        return null;
    }

    public getIntroForState(): Music | null {
        return this.intro;
    }

    public getLoopForState(): Music | null {
        return this.loop;
    }

    public isPlayingForState(): boolean {
        return this.playing;
    }

    public setPlayingForState(playing: boolean): void {
        this.playing = playing;
        this.stopWatchPausedPart = null;
        this.stopWatchPendingStart = playing && isStopWatchMusicHeld(this);
    }
}
