import { GameContainer, Graphics } from "slick2d-ts";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";

export class BrickFragment extends Thing {
    public constructor(main: Main, x: number, y: number, vx: number, vy: number) {
        super(main, 16, 16);
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
    }

    public update(gc: GameContainer): boolean {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += Main.GRAVITY;

        if (this.y > 352) {
            return false;
        }

        return true;
    }

    public render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.brickFragment, this.x, this.y);
    }
}
