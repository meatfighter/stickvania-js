import { GameContainer, Graphics } from "slick2d-ts";
import { Main } from "./Main.js";
import { Thing } from "./Thing.js";

export class Axe extends Thing {
    public angle: number = 0;
    public vAngle: number = 0;
    public soundDelay: number = 0;
    public constructor(main: Main, x: number, y: number, direction: number) {
        super(main, 32, 32);
        this.x = x;
        this.y = y;
        this.vx = direction == Main.RIGHT ? 3 : -3;
        this.vAngle = direction == Main.RIGHT ? 6 : -6;
        this.vy = -6.5;

    }
    public update(gc: GameContainer): boolean {

        if (this.soundDelay > 0) {
            this.soundDelay--;
        } else {
            this.soundDelay = 20;
            this.main.playSound(this.main.spinning);
        }

        this.angle += this.vAngle;
        this.x += this.vx;
        this.y += this.vy;
        this.vy += Main.GRAVITY;
        if (this.x < this.main.camera - 96 || this.x > this.main.camera + 576 || this.y > 352) {
            return false;
        }
        return true;

    }
    public render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.axe, this.x, this.y, this.angle);

    }
}
