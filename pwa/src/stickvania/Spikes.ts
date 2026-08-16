import { GameContainer, Graphics } from "slick2d-ts";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";

export class Spikes extends Thing {
    private top: number = 0;
    private index: number = 0;
    private lifting: boolean = false;
    private liftFast: boolean = false;
    public constructor(main: Main, x: number, y: number, index: number) {
        super(main, 64, 32);
        this.x = x;
        this.top = this.y = y;
        this.index = index;
    }

    public update(gc: GameContainer): boolean {
        if (this.main.timeFrozen == 0) {
            if (this.lifting) {
                if (this.liftFast) {
                    this.y -= 2;
                } else {
                    this.y -= 1;
                }
                if (this.y <= this.top) {
                    this.y = this.top;
                    this.vy = 0;
                    this.lifting = false;
                    if (this.index == 0) {
                        this.liftFast = !this.liftFast;
                    }
                }
            } else {
                this.applyGravity();
                if (this.supported || (this.index == 1 && this.y >= this.top + 78)) {
                    this.lifting = true;
                    this.main.playSound(this.main.ching);
                    if (this.index == 1) {
                        this.y = this.top + 78;
                    }
                }
            }
        }

        if (this.main.intersectsSimon(this)) {
            this.main.hurtSimon(16);
        }

        return true;
    }

    public render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.spikes, this.x, this.y);
    }
}
