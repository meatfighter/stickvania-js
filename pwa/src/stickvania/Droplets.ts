import { GameContainer, Graphics } from "slick2d-ts";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";

export class Droplets extends Thing {
    public constructor(main: Main, x: number, y: number, vx: number, vy: number) {
        super(main, 16, 32);
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
    }

    public update(gc: GameContainer): boolean {
        if (this.vy > 0 && this.y > 352) {
            return false;
        }

        this.x += this.vx;
        this.y += this.vy;

        this.vy += Main.GRAVITY;

        return true;
    }

    public render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.droplets, this.x, this.y);
    }
}
