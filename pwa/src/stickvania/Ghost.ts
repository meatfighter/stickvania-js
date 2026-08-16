import { GameContainer, Graphics } from "slick2d-ts";
import { Flame } from "./Flame.js";
import { cc, trunc } from "./JavaMath.js";
import { Main } from "./Main.js";
import { Spark } from "./Spark.js";
import { Thing } from "./Thing.js";

export class Ghost extends Thing {
    private static readonly FRACTION: number = 1 / 91;
    public active: boolean = false;
    private fadeIn: number = 0;
    private direction: number = 0;
    private spriteIndex: number = 0;
    private targetX: number = 0;
    public hits: number = 2;
    private stunned: number = 0;
    public constructor(main: Main, x: number, y: number) {
        super(main, 32, 32);
        this.x = x;
        this.y = y;
        this.hits = main.adjustEnemyHits(this.hits);

    }
    public update(gc: GameContainer): boolean {

        if (this.fadeIn == 91) {
            if (this.kill) {
                this.hits = 0;
                this.stunned = 0;
            }

            if (this.stunned > 0) {
                this.stunned--;
            } else if (this.main.intersectsWhip(this)
                || this.main.intersectsWeapon(this) || this.kill) {
                this.main.pushThing(new Spark(this.main, this));
                if (--this.hits <= 0) {
                    if (this.main.random.nextBoolean()) {
                        this.main.pushThing(this.main.createCandleItem(trunc(this.x), trunc(this.y), cc("h")));
                    }
                    this.main.pushThing(new Flame(this.main, this.x, this.y, 0, 0, -0.05, 0, 10));
                    this.main.addPoints(300);
                    this.main.playSound(this.main.killed_4);
                    return false;
                } else {
                    this.stunned = 45;
                    this.main.playSound(this.main.stunned);
                }
            }

            if (this.main.intersectsSimon(this)) {
                this.main.hurtSimon(2);
            }
        }

        if (this.main.timeFrozen == 0) {
            if (this.active) {
                if (this.fadeIn < 91) {
                    this.fadeIn++;
                } else {
                    if (this.direction == Main.LEFT) {
                        this.x -= 0.75;
                        if (this.x <= this.targetX) {
                            this.targetX = this.main.simon.x + 96;
                            this.direction = this.targetX < this.x ? Main.LEFT : Main.RIGHT;
                        }
                    } else {
                        this.x += 0.75;
                        if (this.x >= this.targetX) {
                            this.targetX = this.main.simon.x - 64;
                            this.direction = this.targetX < this.x ? Main.LEFT : Main.RIGHT;
                        }
                    }
                    if (this.main.simon.y + 12 < this.y) {
                        this.y -= 0.25;
                    } else if (this.main.simon.y + 12 > this.y) {
                        this.y += 0.25;
                    }
                }
            } else if (this.main.intersectsSimon(this)) {
                this.active = true;
                this.y += 64;
                if (this.main.simon.direction == Main.LEFT) {
                    this.x += 128;
                    this.direction = Main.LEFT;
                    this.targetX = this.main.simon.x - 64;
                } else {
                    this.x -= 128;
                    this.direction = Main.RIGHT;
                    this.targetX = this.main.simon.x + 96;
                }
            }
        }

        return true;

    }
    public render(gc: GameContainer, g: Graphics): void {
        if (this.fadeIn > 90) {
            this.main.draw(this.main.ghosts[this.direction][this.spriteIndex], this.x, this.y);
        } else {
            this.main.drawFaded(this.main.ghosts[this.direction][this.spriteIndex], this.x, this.y, this.fadeIn * Ghost.FRACTION);
        }

    }
}
