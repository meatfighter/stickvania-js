import { GameContainer, Graphics } from "slick2d-ts";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";
import { javaFloat } from "./JavaMath.js";

export class Axe extends Thing {
    public angle: number = javaFloat(0);
    public vAngle: number = javaFloat(0);
    public soundDelay: number = 0;
    public constructor(main: Main, x: number, y: number, direction: number) {
        x = javaFloat(x);
        y = javaFloat(y);
        super(main, 32, 32);
        this.x = javaFloat(x);
        this.y = javaFloat(y);
        this.vx = javaFloat(direction == Main.RIGHT ? 3 : -3);
        this.vAngle = javaFloat(direction == Main.RIGHT ? 6 : -6);
        this.vy = javaFloat(-6.5);
    }

    public override update(gc: GameContainer): boolean {
        if (this.soundDelay > 0) {
            this.soundDelay--;
        } else {
            this.soundDelay = 20;
            this.main.playSound(this.main.spinning);
        }

        this.angle = javaFloat(this.angle + this.vAngle);
        this.x = javaFloat(this.x + this.vx);
        this.y = javaFloat(this.y + this.vy);
        this.vy = javaFloat(this.vy + Main.GRAVITY);
        if (this.x < this.main.camera - 96 || this.x > this.main.camera + 576 || this.y > 352) {
            return false;
        }
        return true;
    }

    public override render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.axe, this.x, this.y, this.angle);
    }
}
