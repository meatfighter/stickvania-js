import { GameContainer, Graphics } from "slick2d-ts";
import { Flame } from "./Flame.js";
import { Main } from "./Main.js";
import { Spark } from "./Spark.js";
import { Thing } from "./Thing.js";
import { javaFloat } from "./JavaMath.js";

export class Bone extends Thing {
    private angle: number = javaFloat(0);
    private vAngle: number = javaFloat(0);
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

        this.vAngle = javaFloat(vx > 0 ? 6 : -6);
    }

    public override update(gc: GameContainer): boolean {
        if (this.main.intersectsSimon(this)) {
            this.main.hurtSimon(2);
            this.kill = true;
        }

        if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this) || this.kill) {
            this.main.pushThing(new Spark(this.main, this));
            this.main.pushThing(new Flame(this.main, javaFloat(this.x + 4), this.y, 0, 0, -0.05, 0, 10));
            this.main.addPoints(100);
            this.main.playSound(this.main.snuffed);
            return false;
        }

        if (this.main.timeFrozen == 0) {
            this.angle = javaFloat(this.angle + this.vAngle);
            this.x = javaFloat(this.x + this.vx);
            this.y = javaFloat(this.y + this.vy);
            this.vy = javaFloat(this.vy + Main.GRAVITY);
            if (this.y > 352 || this.x < this.main.camera - 96 || this.x > this.main.camera + 576) {
                return false;
            }
        }

        return true;
    }

    public override render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.bone, javaFloat(this.x + 8), this.y, this.angle);
    }
}
