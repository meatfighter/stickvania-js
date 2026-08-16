import { GameContainer, Graphics } from "slick2d-ts";
import { Flame } from "./Flame.js";
import { Main } from "./Main.js";
import { Spark } from "./Spark.js";
import { Thing } from "./Thing.js";

export class Bone extends Thing {
    private angle: number = 0;
    private vAngle: number = 0;
    public constructor(main: Main, x: number, y: number, vx: number, vy: number) {
        super(main, 32, 32);
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;

        this.vAngle = vx > 0 ? 6 : -6;
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
            this.angle += this.vAngle;
            this.x += this.vx;
            this.y += this.vy;
            this.vy += Main.GRAVITY;
            if (this.y > 352 || this.x < this.main.camera - 96 || this.x > this.main.camera + 576) {
                return false;
            }
        }

        return true;
    }

    public render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.bone, this.x + 8, this.y, this.angle);
    }
}
