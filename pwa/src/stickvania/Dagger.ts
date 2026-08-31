import { GameContainer, Graphics } from "slick2d-ts";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";
import { javaFloat } from "./JavaMath.js";

export class Dagger extends Thing {
    public direction: number = 0;
    public constructor(main: Main, x: number, y: number, direction: number) {
        x = javaFloat(x);
        y = javaFloat(y);
        super(main, 0, 8, 32, 14);
        this.x = javaFloat(x);
        this.y = javaFloat(y);
        this.direction = direction;
        main.playSound(main.threw_dagger);
    }

    public override update(gc: GameContainer): boolean {
        if (this.direction == Main.RIGHT) {
            this.x = javaFloat(this.x + 6);
        } else {
            this.x = javaFloat(this.x - 6);
        }
        if (this.x < this.main.camera - 32 || this.x > this.main.camera + 512 || this.intersected) {
            return false;
        }
        return true;
    }

    public override render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.daggers[this.direction], this.x, this.y);
    }
}
