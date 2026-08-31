import { GameContainer, Graphics } from "slick2d-ts";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";
import { javaFloat } from "./JavaMath.js";

export class ShootingSpark extends Thing {
    public constructor(main: Main, x: number, y: number, vx: number, vy: number) {
        x = javaFloat(x);
        y = javaFloat(y);
        vx = javaFloat(vx);
        vy = javaFloat(vy);
        super(main, 32, 32);

        this.x = javaFloat(x);
        this.y = javaFloat(y);
        this.vx = javaFloat(vx);
        this.vy = javaFloat(vy);
    }

    public override update(gc: GameContainer): boolean {
        this.x = javaFloat(this.x + this.vx);
        this.y = javaFloat(this.y + this.vy);

        if (this.y < -32 || this.y > 352 || this.x < this.main.camera - 32 || this.x > this.main.camera + 512) {
            return false;
        }

        return true;
    }

    public override render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.spark, this.x, this.y);
    }
}
