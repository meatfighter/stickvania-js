import { GameContainer, Graphics } from "slick2d-ts";
import { AxeKnight } from "./AxeKnight.js";
import { Flame } from "./Flame.js";
import { Main } from "./Main.js";
import { Spark } from "./Spark.js";
import { Thing } from "./Thing.js";

export class BoomerangAxe extends Thing {
    public static readonly STATE_FOWARD: number = 0;
    public static readonly STATE_REVERSING: number = 1;
    public static readonly STATE_REVERSE: number = 2;
    public static readonly G: number = -0.093257718966603654694391934467333;
    public direction: number = 0;
    public state: number = 0;
    public angle: number = 0;
    public g: number = 0;
    private axeKnight: AxeKnight = null;
    private targetX: number = 0;
    private soundDelay: number = 0;
    public constructor(main: Main, x: number, y: number, direction: number, axeKnight: AxeKnight) {
        super(main, 32, 32);
        this.x = x;
        this.y = y;
        this.direction = direction;
        this.state = BoomerangAxe.STATE_FOWARD;
        this.axeKnight = axeKnight;

        if (direction == Main.RIGHT) {
            this.vx = 2;
            this.g = BoomerangAxe.G;
            this.targetX = Math.min(axeKnight.x + 304, main.camera + 448);
        } else {
            this.vx = -2;
            this.g = -BoomerangAxe.G;
            this.targetX = Math.max(axeKnight.x - 256, main.camera + 32);
        }
    }

    public update(gc: GameContainer): boolean {
        if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this) || this.kill) {
            this.main.pushThing(new Spark(this.main, this));
            this.main.pushThing(new Flame(this.main, this.x, this.y, 0, 0, -0.05, 0, 10));
            this.main.addPoints(100);
            this.axeKnight.axeGone();
            this.main.playSound(this.main.snuffed);
            return false;
        } else if (this.main.intersectsSimon(this)) {
            this.main.hurtSimon(1);
        }

        if (this.main.timeFrozen == 0) {
            if (this.soundDelay > 0) {
                this.soundDelay--;
            } else {
                this.soundDelay = 20;
                this.main.playSound(this.main.spinning);
            }

            switch (this.state) {
                case BoomerangAxe.STATE_FOWARD:
                    if (this.direction == Main.RIGHT) {
                        this.x += 2;
                        this.angle += 6;
                        if (this.x >= this.targetX) {
                            this.state = BoomerangAxe.STATE_REVERSING;
                        }
                    } else {
                        this.x -= 2;
                        this.angle -= 6;
                        if (this.x <= this.targetX) {
                            this.state = BoomerangAxe.STATE_REVERSING;
                        }
                    }
                    break;
                case BoomerangAxe.STATE_REVERSING:
                    this.vx += this.g;
                    this.x += this.vx;
                    this.angle += 3 * this.vx;
                    if (Math.abs(this.vx) >= 2) {
                        this.state = BoomerangAxe.STATE_REVERSE;
                    }
                    break;
                case BoomerangAxe.STATE_REVERSE:
                    if (this.direction == Main.RIGHT) {
                        this.x -= 2;
                        this.angle -= 6;
                    } else {
                        this.x += 2;
                        this.angle += 6;
                    }
                    if (!this.axeKnight.dead && this.main.intersects(this, this.axeKnight)) {
                        this.axeKnight.axeGone();
                        return false;
                    }
                    break;
            }
            if (this.x < this.main.camera - 96 || this.x > this.main.camera + 576) {
                this.axeKnight.axeGone();
                return false;
            }
        }

        return true;
    }

    public render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.axe, this.x, this.y, this.angle);
    }
}
