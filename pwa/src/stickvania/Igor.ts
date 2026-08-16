import { GameContainer, Graphics } from "slick2d-ts";
import { Flame } from "./Flame.js";
import { cc, trunc } from "./JavaMath.js";
import { Main } from "./Main.js";
import { Spark } from "./Spark.js";
import { Thing } from "./Thing.js";

export class Igor extends Thing {
    public direction: number = 0;
    private spriteIndex: number = 0;
    private spriteIndexIncrementor: number = 0;
    private delay: number = 0;
    private active: boolean = false;
    public constructor(main: Main, x: number, y: number) {
        super(main, 32, 32);
        this.x = x;
        this.y = y;
    }

    public update(gc: GameContainer): boolean {
        if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this) || this.kill) {
            this.main.pushThing(new Spark(this.main, this));
            this.main.pushThing(new Flame(this.main, this.x, this.y, 0, 0, -0.05, 0, 10));
            if (this.main.random.nextBoolean()) {
                this.main.pushThing(this.main.createCandleItem(trunc(this.x), trunc(this.y), cc("h")));
            }
            this.main.addPoints(500);
            this.main.playSound(this.main.killed_5);
            return false;
        }

        if (this.main.timeFrozen == 0) {
            if (this.active) {
                this.applyGravity();

                if (this.y > 352) {
                    return false;
                }

                if (this.supported) {
                    if (++this.spriteIndexIncrementor == 46) {
                        this.spriteIndexIncrementor = 0;
                        if (++this.spriteIndex == 2) {
                            this.spriteIndex = 0;
                        }
                    }

                    if (this.delay > 0) {
                        this.delay--;
                    } else {
                        this.vy = this.main.random.nextBoolean() ? -3 : -8;
                        this.delay = 46 + this.main.random.nextInt(91);
                        if (this.main.simon.x + 16 < this.x) {
                            this.direction = Main.LEFT;
                            this.vx = -1;
                        } else {
                            this.direction = Main.RIGHT;
                            this.vx = 1;
                        }
                    }
                } else {
                    if (!this.moveX(this.vx)) {
                        this.vx = -this.vx;
                        if (this.vx < 0) {
                            this.direction = Main.LEFT;
                        } else {
                            this.direction = Main.RIGHT;
                        }
                    }
                }

                if (this.main.intersectsSimon(this)) {
                    this.main.hurtSimon(3);
                }
            } else if (this.x >= this.main.camera - 32 && this.x <= this.main.camera + 544) {
                this.active = true;
            } else if (this.main.simon.x + 16 < this.x) {
                this.direction = Main.LEFT;
            } else {
                this.direction = Main.RIGHT;
            }
        }

        return true;
    }

    public render(gc: GameContainer, g: Graphics): void {
        this.main.draw(this.main.igors[this.direction][this.spriteIndex], this.x, this.y);
    }
}
