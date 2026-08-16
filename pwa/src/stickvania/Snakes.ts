import { GameContainer, Graphics } from "slick2d-ts";
import { Flame } from "./Flame.js";
import { Main } from "./Main.js";
import { Spark } from "./Spark.js";
import { Thing } from "./Thing.js";

export class Snakes extends Thing {
    public spriteIndex: number = 0;
    public spriteIndexIncrementor: number = 0;
    public constructor(main: Main, x: number, y: number, vx: number, vy: number) {
        super(main, 3, 0, 34, 20);
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;

    }
    public update(gc: GameContainer): boolean {

        if (this.main.intersectsSimon(this)) {
            this.main.hurtSimon(2);
            this.kill = true;
        }

        if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this) || this.kill) {
            this.main.pushThing(new Spark(this.main, this));
            this.main.pushThing(new Flame(this.main, this.x + 4, this.y, 0, 0, -0.05, 0, 10));
            this.main.addPoints(100);
            this.main.playSound(this.main.snuffed);
            return false;
        }

        if (this.main.timeFrozen == 0) {
            if (this.supported) {
                if (++this.spriteIndexIncrementor == 35) {
                    this.spriteIndexIncrementor = 0;
                    if (++this.spriteIndex == 2) {
                        this.spriteIndex = 0;
                    }
                }
            }

            if (!this.moveX(this.vx)) {
                this.vx = -this.vx;
            }
            this.applyGravity();
            if (this.y > 352 || this.x > this.main.camera + 576 || this.x < this.main.camera - 64) {
                return false;
            }
        }

        return true;

    }
    public render(gc: GameContainer, g: Graphics): void {
        if (this.vx < 0) {
            this.main.draw(this.main.snakes[Main.LEFT][this.spriteIndex], this.x, this.y);
        } else {
            this.main.draw(this.main.snakes[Main.RIGHT][this.spriteIndex], this.x, this.y);
        }

    }
}
