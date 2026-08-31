import { FastTrig, GameContainer, Graphics } from "slick2d-ts";
import { Flame } from "./Flame.js";
import { Main } from "./Main.js";
import { Spark } from "./Spark.js";
import { Thing } from "./Thing.js";
import { javaFloat } from "./JavaMath.js";

export class Wrapping extends Thing {
    private direction: number = 0;
    private spriteIndex: number = 0;
    private spriteIndexIncrementor: number = 0;
    private Y: number = javaFloat(0);
    private angle: number = javaFloat(0);
    public constructor(main: Main, x: number, y: number, direction: number) {
        x = javaFloat(x);
        y = javaFloat(y);
        super(main, 32, 32);
        this.x = javaFloat(x);
        this.Y = javaFloat((this.y = javaFloat(y)));
        this.direction = direction;
    }

    public override update(gc: GameContainer): boolean {
        if (this.main.intersectsSimon(this)) {
            this.main.hurtSimon(2);
            this.kill = true;
        }

        if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this) || this.kill) {
            this.main.pushThing(new Spark(this.main, this));
            this.main.pushThing(new Flame(this.main, this.x, this.y, 0, 0, -0.05, 0, 10));
            this.main.addPoints(100);
            this.main.playSound(this.main.snuffed);
            return false;
        }

        if (this.main.timeFrozen == 0) {
            if (++this.spriteIndexIncrementor == 35) {
                this.spriteIndexIncrementor = 0;
                if (++this.spriteIndex == 2) {
                    this.spriteIndex = 0;
                }
            }

            this.y = javaFloat(this.Y + javaFloat(20 * javaFloat(FastTrig.sin(this.angle))));
            this.angle = javaFloat(this.angle + 0.03);
            let targetY: number = javaFloat(this.main.simon!.y + 16);
            if (this.Y > targetY) {
                this.Y = javaFloat(this.Y - 1);
            } else if (this.Y < targetY) {
                this.Y = javaFloat(this.Y + 1);
            }

            if (this.direction == Main.RIGHT) {
                this.x = javaFloat(this.x + 1);
                if (this.x > this.main.camera + 576) {
                    return false;
                }
            } else {
                this.x = javaFloat(this.x - 1);
                if (this.x < this.main.camera - 64) {
                    return false;
                }
            }
        }

        return true;
    }

    public override render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.wrappings[this.direction][this.spriteIndex], this.x, this.y);
    }
}
