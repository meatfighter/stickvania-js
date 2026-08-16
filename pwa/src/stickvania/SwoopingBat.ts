import { FastTrig, GameContainer, Graphics } from "slick2d-ts";
import { Flame } from "./Flame.js";
import { Main } from "./Main.js";
import { Spark } from "./Spark.js";
import { Thing } from "./Thing.js";

export class SwoopingBat extends Thing {
    private static readonly spriteSequence: number[] = [1, 2, 3, 2];
    private direction: number = 0;
    private angle: number = 0;
    private Y: number = 0;
    private targetY: number = 0;
    private spriteIndex: number = 0;
    private spriteDelay: number = 0;
    private sleeping: boolean = true;
    public constructor(main: Main, x: number, y: number) {
        super(main, 32, 32);
        this.x = x;
        this.y = y;
        this.Y = y;
    }

    public update(gc: GameContainer): boolean {
        if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this) || this.kill) {
            this.main.pushThing(new Spark(this.main, this));
            this.main.pushThing(new Flame(this.main, this.x, this.y, 0, 0, -0.05, 0, 10));
            this.main.addPoints(200);
            this.main.playSound(this.main.bat_killed);
            return false;
        }

        if (this.main.timeFrozen == 0) {
            if (this.sleeping) {
                if (Math.abs(this.main.simon.y - this.y) < 80 && Math.abs(this.main.simon.x - this.x) < 200) {
                    this.sleeping = false;
                    if (this.x < this.main.simon.x) {
                        this.direction = Main.RIGHT;
                    } else {
                        this.direction = Main.LEFT;
                    }
                    this.targetY = this.main.simon.y + 8;
                }
            } else {
                if (this.Y < this.targetY) {
                    this.Y += 1;
                } else if (this.Y > this.targetY) {
                    this.Y -= 1;
                }

                this.y = this.Y + 8 * FastTrig.sin(this.angle);
                this.angle += 0.05;

                if (this.direction == Main.RIGHT) {
                    this.x += 1;
                    if (this.x > this.main.camera + 576) {
                        return false;
                    }
                } else {
                    this.x -= 1;
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
        }

        if (this.main.intersectsSimon(this)) {
            this.main.hurtSimon(2);
        }

        return true;
    }

    public render(gc: GameContainer, g: Graphics): void {
        if (this.sleeping) {
            this.main.draw(this.main.bats[this.direction][0], this.x, this.y);
        } else {
            this.main.draw(this.main.bats[this.direction][SwoopingBat.spriteSequence[this.spriteIndex]], this.x, this.y);
        }
    }
}
