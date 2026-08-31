import { GameContainer, Graphics } from "slick2d-ts";
import { Flame } from "./Flame.js";
import { GrimReaper } from "./GrimReaper.js";
import { Main } from "./Main.js";
import { Spark } from "./Spark.js";
import { Thing } from "./Thing.js";
import { javaFloat } from "./JavaMath.js";

export class Sickle extends Thing {
    public static readonly STATE_FOWARD: number = 0;
    public static readonly STATE_REVERSING: number = 1;
    public static readonly STATE_REVERSE: number = 2;
    public static readonly G: number = javaFloat(-0.093257718966603654694391934467333);
    public direction: number = 0;
    public state: number = 0;
    public angle: number = javaFloat(0);
    public g: number = javaFloat(0);
    private grimReaper: GrimReaper = null!;
    private targetX: number = javaFloat(0);
    public soundDelay: number = 0;
    public constructor(main: Main, x: number, y: number, direction: number, grimReaper: GrimReaper) {
        x = javaFloat(x);
        y = javaFloat(y);
        super(main, 32, 32);
        this.x = javaFloat(x);
        this.y = javaFloat(y);
        this.direction = direction;
        this.state = Sickle.STATE_FOWARD;
        this.grimReaper = grimReaper;

        if (direction == Main.RIGHT) {
            this.vx = javaFloat(2);
            this.g = javaFloat(Sickle.G);
            this.targetX = javaFloat(Math.min(javaFloat(grimReaper.x + 208), main.camera + 448));
        } else {
            this.vx = javaFloat(-2);
            this.g = javaFloat(-Sickle.G);
            this.targetX = javaFloat(Math.max(javaFloat(grimReaper.x - 128), main.camera + 32));
        }
    }

    public override update(gc: GameContainer): boolean {
        if (this.soundDelay > 0) {
            this.soundDelay--;
        } else {
            this.soundDelay = 20;
            this.main.playSound(this.main.spinning);
        }

        if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this) || this.kill) {
            this.main.pushThing(new Spark(this.main, this));
            this.main.pushThing(new Flame(this.main, this.x, this.y, 0, 0, -0.05, 0, 10));
            this.main.addPoints(100);
            this.main.playSound(this.main.snuffed);
            this.grimReaper.sickleGone();
            return false;
        } else if (this.main.intersectsSimon(this)) {
            this.main.hurtSimon(1);
        }

        if (this.main.timeFrozen == 0) {
            switch (this.state) {
                case Sickle.STATE_FOWARD:
                    if (this.direction == Main.RIGHT) {
                        this.x = javaFloat(this.x + 2);
                        this.angle = javaFloat(this.angle + 6);
                        if (this.x >= this.targetX) {
                            this.state = Sickle.STATE_REVERSING;
                        }
                    } else {
                        this.x = javaFloat(this.x - 2);
                        this.angle = javaFloat(this.angle - 6);
                        if (this.x <= this.targetX) {
                            this.state = Sickle.STATE_REVERSING;
                        }
                    }
                    break;
                case Sickle.STATE_REVERSING:
                    this.vx = javaFloat(this.vx + this.g);
                    this.x = javaFloat(this.x + this.vx);
                    this.angle = javaFloat(this.angle + javaFloat(3 * this.vx));
                    if (Math.abs(this.vx) >= 2) {
                        this.state = Sickle.STATE_REVERSE;
                    }
                    break;
                case Sickle.STATE_REVERSE:
                    if (this.direction == Main.RIGHT) {
                        this.x = javaFloat(this.x - 2);
                        this.angle = javaFloat(this.angle - 6);
                    } else {
                        this.x = javaFloat(this.x + 2);
                        this.angle = javaFloat(this.angle + 6);
                    }
                    if (!this.grimReaper.dead && this.main.intersects(this, this.grimReaper)) {
                        this.grimReaper.sickleGone();
                        return false;
                    }
                    break;
            }
            if (this.x < this.main.camera - 96 || this.x > this.main.camera + 576) {
                this.grimReaper.sickleGone();
                return false;
            }
        }

        return true;
    }

    public override render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.sickle, this.x, this.y, this.angle);
    }
}
