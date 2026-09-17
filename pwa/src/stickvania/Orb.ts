import { GameContainer, Graphics } from "slick2d-ts";
import type { Main } from "./Main.js";
import { Thing } from "./Thing.js";
import { javaFloat } from "./JavaMath.js";

export class Orb extends Thing {
    public static readonly FRACTION: number = javaFloat(1 / 91);
    public fadeIn: number = 0;
    public appearDelay: number = 0;
    private soundDelay: number = 0;
    public constructor(main: Main, x: number, y: number, appearDelay: number) {
        super(main, 32, 32);
        this.x = javaFloat(x);
        this.y = javaFloat(y);
        this.appearDelay = appearDelay;
    }

    public override update(gc: GameContainer): boolean {
        if (this.appearDelay > 0) {
            this.appearDelay--;
            return true;
        }

        if (this.fadeIn < 91) {
            this.fadeIn++;
        } else {
            if (this.soundDelay > 0) {
                this.soundDelay--;
            } else {
                this.soundDelay = 70;
                this.main.playSound(this.main.heartbeat);
                this.main.playRumble("orbHeartbeat");
            }

            this.applyGravity();

            if (this.main.intersectsSimon(this)) {
                this.main.playRumble("orbCollect");
                this.main.beatStage();
                return false;
            }
        }

        return true;
    }

    public override render(gc: GameContainer, g: Graphics): void {
        if (this.appearDelay == 0) {
            if (this.fadeIn > 90) {
                this.main.draw(this.main.orb, this.x, this.y);
            } else {
                this.main.drawFaded(this.main.orb, this.x, this.y, javaFloat(this.fadeIn * Orb.FRACTION));
            }
        }
    }
}
