import { GameContainer, Graphics } from "slick2d-ts";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";

export class ShootingSpark extends Thing {
    public constructor(main: Main, x: number, y: number, vx: number, vy: number) {
        super(main, 32, 32);

        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;

    }
    public update(gc: GameContainer): boolean {
        this.x += this.vx;
        this.y += this.vy;

        if (this.y < -32 || this.y > 352 || this.x < this.main.camera - 32 || this.x > this.main.camera + 512) {
            return false;
        }

        return true;

    }
    public render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.spark, this.x, this.y);

    }
}
