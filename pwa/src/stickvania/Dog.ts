import { GameContainer, Graphics } from "slick2d-ts";
import { Flame } from "./Flame.js";
import { trunc } from "./JavaMath.js";
import { Main } from "./Main.js";
import { Spark } from "./Spark.js";
import { Thing } from "./Thing.js";

export class Dog extends Thing {
    private readonly STATE_RESTING: number = 0;
    private readonly STATE_RUNNING: number = 1;
    private readonly STATE_JUMPING: number = 2;
    private state: number = this.STATE_RESTING;
    private direction: number = Main.LEFT;
    private spriteIndex: number = 1;
    private spriteIndexIncrementor: number = 0;
    public constructor(main: Main, x: number, y: number) {
        super(main, 64, 32);
        this.x = x;
        this.y = y;
    }

    public update(gc: GameContainer): boolean {
        if (this.main.intersectsWhip(this) || this.main.intersectsWeapon(this) || this.kill) {
            this.main.pushThing(new Spark(this.main, this));
            this.main.pushThing(new Flame(this.main, this.x, this.y, -1, 0, -0.08, 0, 10));
            this.main.pushThing(new Flame(this.main, this.x + 32, this.y, 1, 0, -0.08, 0, 10));
            this.main.addPoints(200);
            this.main.playSound(this.main.dog_killed);
            return false;
        }

        if (this.main.intersectsSimon(this)) {
            this.main.hurtSimon(2);
        }

        if (this.main.timeFrozen == 0) {
            if (this.state == this.STATE_RESTING) {
                if (Math.abs(this.main.simon.x - this.x) < 128) {
                    this.state = this.STATE_RUNNING;
                }
            } else {
                this.applyGravity();

                if (this.state == this.STATE_RUNNING) {
                    if (++this.spriteIndexIncrementor == 15) {
                        this.spriteIndexIncrementor = 0;
                        if (++this.spriteIndex == 4) {
                            this.spriteIndex = 1;
                        }
                    }

                    if (this.direction == Main.LEFT) {
                        if (!this.main.isSupportive(trunc(this.x), trunc(this.y + 33))) {
                            this.vy = Main.SIMON_JUMP_VELOCITY;
                            this.state = this.STATE_JUMPING;
                        } else if (!this.moveX(-3)) {
                            this.direction = Main.RIGHT;
                        }
                    } else {
                        if (!this.main.isSupportive(trunc(this.x + 63), trunc(this.y + 33))) {
                            this.vy = Main.SIMON_JUMP_VELOCITY;
                            this.state = this.STATE_JUMPING;
                        } else if (!this.moveX(3)) {
                            this.direction = Main.LEFT;
                        }
                    }
                } else {
                    if (this.supported) {
                        this.state = this.STATE_RUNNING;

                        if (this.y > this.main.simon.y) {
                            if (this.x + 32 > this.main.simon.x) {
                                this.direction = Main.LEFT;
                            } else {
                                this.direction = Main.RIGHT;
                            }
                        }
                    } else {
                        if (this.direction == Main.LEFT) {
                            this.moveX(-3);
                        } else {
                            this.moveX(3);
                        }
                    }
                }
            }
        }

        return true;
    }

    public render(gc: GameContainer, g: Graphics): void {
        switch (this.state) {
            case this.STATE_RESTING:
                this.main.draw(this.main.dogs[this.direction][0], this.x, this.y);
                break;
            case this.STATE_RUNNING:
                this.main.draw(this.main.dogs[this.direction][this.spriteIndex], this.x, this.y);
                break;
            case this.STATE_JUMPING:
                this.main.draw(this.main.dogs[this.direction][2], this.x, this.y);
                break;
        }
    }
}
