import { GameContainer, Graphics } from "slick2d-ts";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";
import { javaFloat } from "./JavaMath.js";

export class Spikes extends Thing {
    private top: number = javaFloat(0);
    private index: number = 0;
    private lifting: boolean = false;
    private liftFast: boolean = false;
    public constructor(main: Main, x: number, y: number, index: number) {
        x = javaFloat(x);
        y = javaFloat(y);
        super(main, 64, 32);
        this.x = javaFloat(x);
        this.top = javaFloat((this.y = javaFloat(y)));
        this.index = index;
    }

    public override update(gc: GameContainer): boolean {
        if (this.main.timeFrozen == 0) {
            if (this.lifting) {
                if (this.liftFast) {
                    this.y = javaFloat(this.y - 2);
                } else {
                    this.y = javaFloat(this.y - 1);
                }
                if (this.y <= this.top) {
                    this.y = javaFloat(this.top);
                    this.vy = javaFloat(0);
                    this.lifting = false;
                    if (this.index == 0) {
                        this.liftFast = !this.liftFast;
                    }
                }
            } else {
                this.applyGravity();
                if (this.supported || (this.index == 1 && this.y >= javaFloat(this.top + 78))) {
                    this.lifting = true;
                    this.main.playSound(this.main.ching);
                    this.main.playRumble("spikesLand");
                    if (this.index == 1) {
                        this.y = javaFloat(this.top + 78);
                    }
                }
            }
        }

        if (this.main.intersectsSimon(this)) {
            this.main.hurtSimon(16);
        }

        return true;
    }

    public override render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.spikes, this.x, this.y);
    }
}
