import { FastTrig, GameContainer, Graphics } from "slick2d-ts";
import { Flame } from "./Flame.js";
import { Main } from "./Main.js";
import { Spark } from "./Spark.js";
import { Thing } from "./Thing.js";
import { javaFloat } from "./JavaMath.js";

export class Bat extends Thing {
    private static readonly spriteSequence: number[] = [1, 2, 3, 2];
    private direction: number = 0;
    private angle: number = javaFloat(0);
    private Y: number = javaFloat(0);
    private spriteIndex: number = 0;
    private spriteDelay: number = 0;
    public constructor(main: Main, x: number, y: number, direction: number) {
        x = javaFloat(x);
        y = javaFloat(y);
        super(main, 32, 32);
        this.x = javaFloat(x);
        this.Y = javaFloat(y);
        this.direction = direction;
    }

    public override update(gc: GameContainer): boolean {
        if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this) || this.kill) {
            this.main.pushThing(new Spark(this.main, this));
            this.main.pushThing(new Flame(this.main, this.x, this.y, 0, 0, -0.05, 0, 10));
            this.main.addPoints(200);
            this.main.playSound(this.main.bat_killed);
            return false;
        }

        if (this.main.timeFrozen == 0) {
            this.y = javaFloat(this.Y + javaFloat(8 * FastTrig.sin(this.angle)));
            this.angle = javaFloat(this.angle + 0.05);

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

            if (this.spriteDelay == 0) {
                this.spriteDelay = 10;
                if (this.spriteIndex == 0) {
                    this.spriteIndex = 3;
                } else {
                    this.spriteIndex--;
                }
            } else {
                this.spriteDelay--;
            }
        }

        if (this.main.intersectsSimon(this)) {
            this.main.hurtSimon(2);
        }

        return true;
    }

    public override render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.bats[this.direction][Bat.spriteSequence[this.spriteIndex]], this.x, this.y);
    }
}
