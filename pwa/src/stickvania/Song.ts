import { Music } from "slick2d-ts";

export class Song {
    private intro: Music = null;
    private loop: Music = null;
    private playing = false;

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
            this.loop.loop();
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

    public resumeAfterBrowserSuspension(): void {
        if (!this.playing) {
            return;
        }
        if (this.resumeMusicPart(this.intro)) {
            return;
        }
        if (this.resumeMusicPart(this.loop)) {
            return;
        }
        if (this.loop !== null) {
            this.loop.loop();
        } else if (this.intro !== null) {
            this.intro.play();
        }
    }

    private resumeMusicPart(music: Music): boolean {
        if (music === null || !music.playing()) {
            return false;
        }
        music.resume();
        return true;
    }

    public getIntroForState(): Music {
        return this.intro;
    }

    public getLoopForState(): Music {
        return this.loop;
    }

    public isPlayingForState(): boolean {
        return this.playing;
    }

    public setPlayingForState(playing: boolean): void {
        this.playing = playing;
    }
}
