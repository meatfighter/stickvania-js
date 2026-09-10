import { Music } from "slick2d-ts";

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
        if (this.intro !== null && this.intro.playing()) {
            this.intro.stop();
        }
        if (this.loop !== null && this.loop.playing()) {
            this.loop.stop();
        }
        this.playing = false;
    }

    public play(): void {
        if (this.playing) {
            return;
        }
        this.stop();
        if (this.intro === null) {
            this.loop!.loop();
        } else {
            this.intro.play();
        }
        this.playing = true;
    }

    public update(): void {
        if (this.playing) {
            if ((this.intro === null || !this.intro.playing()) && this.loop !== null && !this.loop.playing()) {
                this.loop.loop();
            }
        }
    }

    /**
     * Compatibility hook for the retained game-level suspension API. Slick owns
     * playback-generation reconstruction; this method may only nudge an already
     * logically active Music part and must never choose or start a replacement.
     */
    public resumeAfterBrowserSuspension(): void {
        if (!this.playing) {
            return;
        }
        if (this.resumeMusicPart(this.intro)) {
            return;
        }
        this.resumeMusicPart(this.loop);
    }

    private resumeMusicPart(music: Music | null): boolean {
        if (music === null || !music.playing()) {
            return false;
        }
        music.resume();
        return true;
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
