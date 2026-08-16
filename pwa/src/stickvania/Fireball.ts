import { GameContainer, Graphics, Image } from "slick2d-ts";
import { Flame } from "./Flame.js";
import { Main } from "./Main.js";
import { Spark } from "./Spark.js";
import { Thing } from "./Thing.js";

export class Fireball extends Thing {
    private image: Image = null;
    public constructor(main: Main, x: number, y: number, vx: number, vy: number) {
        super(main, 16, 16);

        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;

        if (vx < 0) {
            this.image = main.fireballs[Main.LEFT];
        } else {
            this.image = main.fireballs[Main.RIGHT];
        }
    }

    public update(gc: GameContainer): boolean {
        if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this) || this.kill) {
            this.main.pushThing(new Spark(this.main, this));
            this.main.pushThing(new Flame(this.main, this.x - 8, this.y, 0, 0, -0.05, 0, 10));
            this.main.addPoints(100);
            this.main.playSound(this.main.snuffed);
            return false;
        }

        if (this.main.intersectsSimon(this)) {
            this.main.hurtSimon(2);
            return false;
        }

        if (this.main.timeFrozen == 0) {
            this.x += this.vx;
            this.y += this.vy;

            if (this.x < this.main.camera - 32 || this.x > this.main.camera + 544 || this.y < 0 || this.y > 532) {
                return false;
            }
        }

        return true;
    }

    public render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.image, this.x, this.y);
    }
}
