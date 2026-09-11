import { Music } from "slick2d-ts";

/** Song chooses the next part; the engine owns disposable playback generations. */
export class Song {
    private intro: Music | null = null;
    private loop: Music | null = null;
    private playing = false;

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
        this.playing = false;
    }

    public play(): void {
        if (this.playing) {
            return;
        }
        this.stop();
        if (this.intro !== null) {
            this.intro.play();
        } else if (this.loop !== null) {
            this.loop.loop();
        } else {
            return;
        }
        this.playing = true;
    }

    public update(): void {
        if (!this.playing || this.intro?.isTransportActive()) {
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
    }
}
